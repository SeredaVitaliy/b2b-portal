import {useEffect, useRef, useState, type ClipboardEvent, type MouseEvent} from 'react';
import {Alert, Button, Input, InputNumber, Modal, Table} from 'antd';
import Papa from 'papaparse';
import type {Market, MarketAction, Offer} from './types';
import {money} from './types';

const FIELDS = ['price', 'stock'] as const;
type Field = typeof FIELDS[number];
type Cell = {id:number; field:Field};
type CellEdit = Cell & {value:number; previous:number};
type Row = {id:number; price:number; stock:number};
type Patch = Partial<Row> & {id:number; expectedPrice?:number; expectedStock?:number};
const key = ({id,field}:Cell) => id+':'+field;
const valid = (field:Field,value:number) =>
  Number.isSafeInteger(value) && value >= (field==='price' ? 1 : 0) && value<=1000000;

function downloadCsv(rows:Row[]) {
  const url = URL.createObjectURL(new Blob(['\ufeff',Papa.unparse(rows,{columns:['id','price','stock']})],{type:'text/csv;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ассортимент.csv';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function Assortment({offers, productName, act, busy, history}:{
  offers:Offer[]; productName:(offer:Offer)=>string; act:MarketAction; busy:boolean; history:Market['history'];
}) {
  const [filter,setFilter]=useState('');
  const [edits,setEdits]=useState<Record<string,CellEdit>>({});
  const [selected,setSelected]=useState<Cell[]>([]);
  const [fill,setFill]=useState<number|null>(null);
  const [error,setError]=useState('');
  const [settings,setSettings]=useState<{id:number;sku:string;pack:number;step:number;active:boolean}>();
  const [historyOffer,setHistoryOffer]=useState<Offer>();
  const csvInput=useRef<HTMLInputElement>(null);
  const anchor=useRef<Cell|null>(null);
  const dragging=useRef(false);
  const visible=offers.filter(offer=>productName(offer).toLowerCase().includes(filter.trim().toLowerCase()))
    .sort((a,b)=>a.id-b.id);
  const byId=new Map(offers.map(offer=>[offer.id,offer]));
  const selectedKeys=new Set(selected.map(key));
  const savedValue=(offer:Offer,field:Field)=>field==='price' ? offer.price! : offer.stock;
  const value=(offer:Offer,field:Field)=>edits[key({id:offer.id,field})]?.value ?? savedValue(offer,field);

  useEffect(()=>{
    const release=()=>{dragging.current=false;};
    window.addEventListener('mouseup',release);
    window.addEventListener('blur',release);
    return ()=>{
      window.removeEventListener('mouseup',release);
      window.removeEventListener('blur',release);
    };
  },[]);

  function selectRange(from:Cell,to:Cell) {
    const a=visible.findIndex(offer=>offer.id===from.id);
    const b=visible.findIndex(offer=>offer.id===to.id);
    if(a<0 || b<0) return;
    const first=Math.min(FIELDS.indexOf(from.field),FIELDS.indexOf(to.field));
    const last=Math.max(FIELDS.indexOf(from.field),FIELDS.indexOf(to.field));
    setSelected(visible.slice(Math.min(a,b),Math.max(a,b)+1)
      .flatMap(offer=>FIELDS.slice(first,last+1).map(field=>({id:offer.id,field}))));
  }

  function select(cell:Cell,event:MouseEvent) {
    if(event.button!==0) return;
    if(event.shiftKey && anchor.current) {
      selectRange(anchor.current,cell);
      return;
    }
    anchor.current=cell;
    if(event.ctrlKey || event.metaKey) {
      setSelected(current=>selectedKeys.has(key(cell))?current.filter(item=>key(item)!==key(cell)):[...current,cell]);
      return;
    }
    dragging.current=true;
    setSelected([cell]);
  }

  function stage(changes:{cell:Cell;value:number}[]) {
    setError('');
    setEdits(current=>{
      const next={...current};
      for(const change of changes) {
        const {cell,value}=change;
        const offer=byId.get(cell.id);
        if(!offer) continue;
        const name=key(cell);
        const original=savedValue(offer,cell.field);
        if(value===original) delete next[name];
        else next[name]={...cell,value,previous:current[name]?.previous ?? original};
      }
      return next;
    });
  }

  function paste(event:ClipboardEvent, cell:Cell) {
    const text=event.clipboardData.getData('text/plain').trimEnd();
    if(!text) return;
    event.preventDefault();
    const rowStart=visible.findIndex(offer=>offer.id===cell.id);
    const columnStart=FIELDS.indexOf(cell.field);
    const changes:{cell:Cell;value:number}[]=[];
    for(const [y,line] of text.split(/\r?\n/).entries()) {
      for(const [x,raw] of line.split('\t').entries()) {
        const text=raw.trim().replace(/[\u00a0\u202f ]/g,'');
        if(!text) continue;
        const offer=visible[rowStart+y];
        const field=FIELDS[columnStart+x];
        if(!offer || !field || !/^\d+$/.test(text) || !valid(field,Number(text))) {
          setError('Проверьте диапазон вставки. Допустимы целые цены от 1 и остатки от 0.');
          return;
        }
        changes.push({cell:{id:offer.id,field},value:Number(text)});
      }
    }
    stage(changes);
  }

  const patches=new Map<number,Patch>();
  for(const edit of Object.values(edits)) {
    if(!byId.has(edit.id)) continue;
    const row=patches.get(edit.id) ?? {id:edit.id};
    row[edit.field]=edit.value;
    row[edit.field==='price'?'expectedPrice':'expectedStock']=edit.previous;
    patches.set(edit.id,row);
  }

  function save(rows:Patch[]) {
    void act('offers-batch',{rows},()=>{
      const saved=new Map(rows.map(row=>[row.id,row]));
      setEdits(current=>Object.fromEntries(Object.entries(current).filter(([,edit])=>
        saved.get(edit.id)?.[edit.field]!==edit.value)));
    });
  }

  function reset() {
    setEdits({});
    setSelected([]);
    setError('');
    anchor.current=null;
  }

  async function importCsv(file:File) {
    const csv=await new Promise<Papa.ParseResult<Record<string,string>>>((resolve,reject)=>{
      Papa.parse<Record<string,string>,File>(file,{header:true,skipEmptyLines:'greedy',worker:Papa.WORKERS_SUPPORTED,
        complete:resolve,error:reject});
    });
    const hasId=csv.meta.fields?.includes('id');
    if(csv.errors.length || !csv.meta.fields?.includes('price') || (!hasId && !csv.meta.fields?.includes('sku')) || !csv.data.length) {
      setError('В CSV нужны id или sku и колонка price. Колонка stock необязательна.');
      return;
    }
    const bySku=new Map<string,Offer[]>();
    for(const offer of offers) {
      const sku=offer.sku?.trim().toLowerCase();
      if(sku) bySku.set(sku,[...(bySku.get(sku)??[]),offer]);
    }
    const seen=new Set<number>();
    const changes:{cell:Cell;value:number}[]=[];
    for(const [index,line] of csv.data.entries()) {
      const matches=bySku.get(line.sku?.trim().toLowerCase())??[];
      const id=hasId && /^\d+$/.test(line.id?.trim()) ? Number(line.id) : !hasId && matches.length===1 ? matches[0].id : NaN;
      const fields=FIELDS.filter(field=>field==='price'||line.stock?.trim());
      if(!byId.has(id) || seen.has(id) || !fields.every(field=>/^\d+$/.test(line[field]?.trim()) && valid(field,Number(line[field])))) {
        setError('Строка '+(index+2)+': проверьте артикул, цену и остаток. Повторы и неоднозначные артикулы не допускаются.');
        return;
      }
      seen.add(id);
      for(const field of fields) changes.push({cell:{id,field},value:Number(line[field])});
    }
    stage(changes);
  }

  const exportRows=()=>visible.map(offer=>({id:offer.id,price:value(offer,'price'),stock:value(offer,'stock')}));
  async function exportExcel() {
    const {utils,writeFile}=await import('xlsx');
    const book=utils.book_new();
    utils.book_append_sheet(book,utils.json_to_sheet(exportRows()),'Ассортимент');
    writeFile(book,'ассортимент.xlsx');
  }

  function renderCell(offer:Offer,field:Field,label:string) {
    const cell={id:offer.id,field};
    const draft=edits[key(cell)];
    const conflict=draft && draft.previous!==savedValue(offer,field);
    return <div className={'offer-cell'+(selectedKeys.has(key(cell))?' is-selected':'')}
      onMouseDown={event=>select(cell,event)} onMouseEnter={()=>{if(dragging.current && anchor.current) selectRange(anchor.current,cell);}}
      onPaste={event=>{if(!busy) paste(event,cell);}}>
      <InputNumber aria-label={label+' · '+productName(offer)} min={field==='price'?1:0} max={1000000}
        precision={0} disabled={busy} value={value(offer,field)} status={conflict?'error':draft?'warning':undefined}
        onChange={next=>{if(next!==null && valid(field,next)) stage([{cell,value:next}]);}}/>
      {conflict&&<Button size="small" onClick={()=>setEdits(current=>{
        const next={...current};
        delete next[key(cell)];
        return next;
      })}>Взять актуальное</Button>}
    </div>;
  }

  return <section aria-labelledby="assortment-title">
    <div className="heading"><h2 id="assortment-title">Редактор цен и остатков</h2><Input aria-label="Поиск в ассортименте" placeholder="Найти в ассортименте"
      value={filter} onChange={event=>{setFilter(event.target.value);setSelected([]);anchor.current=null;}}/></div>
    <p className="sheet-help">Выделите диапазон мышью или через Shift. Чтобы вставить диапазон из Excel, нажмите на первую ячейку и вставьте данные.</p>
    <div className="filters">
      <InputNumber aria-label="Значение заливки" placeholder="Значение" min={0} max={1000000} precision={0} value={fill} onChange={setFill}/>
      <Button disabled={busy || fill===null || !selected.length} onClick={()=>{
        if(fill===null) return;
        if(!selected.every(cell=>valid(cell.field,fill))) {setError('Цена должна быть больше нуля.');return;}
        stage(selected.map(cell=>({cell,value:fill})));
      }}>Применить к выделенным ({selected.length})</Button>
      <Button onClick={()=>downloadCsv(exportRows())}>Экспорт CSV</Button>
      <Button onClick={()=>void exportExcel().catch(()=>setError('Не удалось выгрузить Excel.'))}>Экспорт Excel</Button>
      <input ref={csvInput} hidden type="file" accept=".csv,text/csv" disabled={busy} onChange={event=>{
        const file=event.currentTarget.files?.[0];
        event.currentTarget.value='';
        if(file) void importCsv(file).catch(()=>setError('Не удалось прочитать CSV.'));
      }}/>
      <Button disabled={busy} onClick={()=>csvInput.current?.click()}>Импорт CSV</Button>
      <Button disabled={busy||!patches.size} onClick={reset}>Сбросить изменения</Button>
      <Button type="primary" loading={busy} disabled={!patches.size} onClick={()=>save([...patches.values()])}>
        Сохранить изменения{patches.size?' · '+patches.size:''}
      </Button>
    </div>
    {error&&<Alert type="error" message={error}/>}
    <Table<Offer> rowKey="id" dataSource={visible} virtual pagination={false} scroll={{x:710,y:420}} columns={[
      {title:'Товар',dataIndex:'product',width:260,render:(_,offer)=>productName(offer)},
      {title:'Цена за упаковку, ₽',width:155,render:(_,offer)=>renderCell(offer,'price','Цена')},
      {title:'Остаток, уп.',width:145,render:(_,offer)=>renderCell(offer,'stock','Остаток')},
      {title:'Предложение',width:150,render:(_,offer)=><div className="offer-actions">
        <Button size="small" onClick={()=>setSettings({id:offer.id,sku:offer.sku??'',pack:offer.pack,step:offer.step??offer.pack,active:offer.active!==false})}>
          {offer.active===false?'Скрыто':'Условия'}
        </Button>
        <Button size="small" onClick={()=>setHistoryOffer(offer)}>История</Button>
        <Button size="small" disabled={busy||!patches.has(offer.id)} onClick={()=>save([patches.get(offer.id)!])}>Сохранить строку</Button>
      </div>},
    ]}/>
    <Modal open={!!historyOffer} title={historyOffer?'История · '+productName(historyOffer):'История'}
      onCancel={()=>setHistoryOffer(undefined)} footer={null}>
      <Table rowKey="id" size="small" pagination={false} dataSource={history.filter(row=>row.offer===historyOffer?.id)} columns={[
        {title:'Цена',render:(_,row)=>money(row.price_before)+' → '+money(row.price_after)},
        {title:'Остаток',render:(_,row)=>row.stock_before+' → '+row.stock_after},
        {title:'Дата',render:(_,row)=>new Date(row.created).toLocaleString('ru-RU',{timeZone:'Europe/Kaliningrad'})},
      ]}/>
    </Modal>
    <Modal open={!!settings} title="Условия предложения" onCancel={()=>setSettings(undefined)} okText="Сохранить" cancelText="Отмена"
      confirmLoading={busy} onOk={()=>settings&&void act('offer-details',settings,()=>setSettings(undefined))}>
      {settings&&<div className="rolelist">
        <label>Артикул<Input value={settings.sku} maxLength={80} onChange={event=>setSettings({...settings,sku:event.target.value})}/></label>
        <label>Минимальная партия <InputNumber min={1} max={1000000} precision={0} value={settings.pack} onChange={pack=>pack!==null&&setSettings({...settings,pack})}/></label>
        <label>Шаг заказа <InputNumber min={1} max={1000000} precision={0} value={settings.step} onChange={step=>step!==null&&setSettings({...settings,step})}/></label>
        <label><input type="checkbox" checked={settings.active} onChange={event=>setSettings({...settings,active:event.target.checked})}/> Показывать в каталоге</label>
      </div>}
    </Modal>
  </section>;
}
