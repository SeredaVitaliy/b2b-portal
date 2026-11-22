import type {Product} from './types';

const images: Record<string,string> = {
 'Капуста':'cabbage','Морковь':'carrots','Огурцы':'cucumber','Лук':'onion',
 'Перец':'pepper','Картофель':'potato','Свёкла':'beetroot','Томаты':'tomato',
 'Кефир':'kefir','Молоко 3.2%':'milk','Масло сливочное':'butter','Ряженка':'ryazhenka',
 'Сливки 33%':'cream','Сметана':'sour-cream','Творог':'cottage-cheese','Йогурт':'yogurt',
 'Камбала':'flounder','Кальмар':'squid','Креветки':'shrimp','Сельдь':'herring',
 'Скумбрия':'mackerel','Филе лосося':'salmon','Филе судака':'zander','Филе трески':'cod',
 'Апельсины':'orange','Бананы':'banana','Груши':'pear','Киви':'kiwi',
 'Лимоны':'lemon','Мандарины':'mandarin','Сливы':'plum','Яблоки':'apple',
 'Бублик':'tart-bagel','Багет':'baguette','Бриошь':'brioche','Булочка':'bread-roll',
 'Круассан':'croissant','Фокачча':'focaccia','Хлеб ржаной':'rye-bread','Чиабатта':'ciabatta',
 'Гречка':'buckwheat','Макароны':'pasta','Мука':'flour','Нут':'chickpeas',
 'Рис':'rice','Сахар':'sugar','Фасоль':'beans','Чечевица':'lentils',
 'Говядина':'beef','Фарш говяжий':'ground-beef','Бедро куриное':'chicken-thigh','Утка':'duck',
 'Баранина':'lamb','Свинина':'pork','Филе индейки':'turkey','Филе куриное':'chicken',
 'Какао':'cocoa','Кофе в зёрнах':'coffee','Морс':'berry-drink','Сироп':'syrup',
 'Сок томатный':'tomato-juice','Сок яблочный':'apple-juice','Чай зелёный':'green-tea','Чай чёрный':'black-tea',
};

export function ProductImage({product, detail=false}:{product:Product;detail?:boolean}) {
 const file = images[product.name.split(',')[0].trim()];
 const src = file ? '/ingredients/'+file+'.jpg' : '/market-hero.jpg';
 return <div className={detail?'product-photo product-photo-detail':'product-photo'}>
  <img src={src} alt={detail&&file?product.name:''} loading={detail?'eager':'lazy'} width={256} height={256}
    onError={event=>{if(!event.currentTarget.src.endsWith('/market-hero.jpg'))event.currentTarget.src='/market-hero.jpg';}}/>
 </div>;
}
