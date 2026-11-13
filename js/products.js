// ------------------------------------------------------------
// Shop products
//
// category:    "food" | "merch" | "gifts"
// price:       in Rand, numbers only
// image:       path like "images/hot-honey.jpg" (leave "" for a placeholder)
// note:        optional small line under the description
// details:     optional text in a "Details" drop-down (ingredients, sizing, care)
// options:     optional choice shown as a drop-down, e.g. sizes. Add `prices`
//              (same order as `choices`) when each choice costs something different.
// collectOnly: true for fresh/frozen items – the basket then only offers collection
// featured:    true shows it on the home page
// buyUrl:      send people to another checkout instead of the basket
//              (e.g. Storekit for frozen pizzas).
//
// Hot honey, pesto and gift box prices are placeholders – check them.
// Pesto is fresh, so it is frozen and collect-only: never courier it unless a lab has validated it as shelf-stable.
// Merch and frozen pizza prices match Storekit.
// ------------------------------------------------------------
window.PRODUCTS = [
  {
    id: "hot-honey",
    name: "Hot Honey",
    category: "food",
    price: 120,
    size: "250 g jar",
    description: "Our chilli-infused honey. Honey with a zing – you were put on this earth to have it on your pepperoni pizza.",
    details: "Ingredients: honey, dried chilli. [Add honey origin, best-before and allergens.] Not suitable for infants under 12 months.",
    image: "images/hot-honey.jpg",
    featured: true,
  },
  {
    id: "basil-pesto",
    name: "Basil Pesto",
    category: "food",
    price: 70,
    size: "120 g tub, frozen",
    description: "House pesto made in small batches with fresh basil, parmesan and good olive oil. Frozen to keep it fresh.",
    details: "Ingredients: [list]. Contains dairy [and nuts, if used]. Keep frozen; defrost in the fridge and use within 5 days.",
    note: "Collect in store only",
    collectOnly: true,
    image: "",
    featured: false,
  },
  {
    id: "frozen-margherita",
    name: "Frozen Margheritas",
    category: "food",
    price: 200,
    size: "Pack of 2",
    description: "Two of our OG Neapolitan-style Margheritas, ready to reheat and serve at home.",
    note: "Collect in store only – order on Storekit",
    image: "https://ucarecdn.com/55155210-0680-4e18-8b5d-0312729f3af0/-/resize/576x/-/format/auto/",
    featured: false,
    buyUrl: "https://order.storekit.com/the-nose-pizza/basket/72:1",
  },
  {
    id: "workwear",
    name: "Eppie's Workwear",
    category: "merch",
    price: 339,
    size: "Shirt · S – XXL",
    description: "The same shirt the artists wear behind the counter, with the chef on the back. Sauce stains not included.",
    details: "[Fabric, e.g. 100% cotton.] [Fit and size chart: chest width per size.] Wash cold, inside out.",
    options: { label: "Size", choices: ["S", "M", "L", "XL", "XXL"] },
    image: "images/tees.jpg",
    featured: true,
  },
  {
    id: "dad-cap",
    name: "Dad Cap",
    category: "merch",
    price: 249,
    size: "One size",
    description: "Embroidered cap. Wear it forwards, backwards, or the way Dad does.",
    details: "[Fabric.] Adjustable strap, one size fits most.",
    image: "",
    featured: false,
  },
  {
    id: "the-fit",
    name: "The Fit",
    category: "merch",
    price: 560,
    size: "Workwear shirt + Dad Cap",
    description: "The full uniform. One Eppie's Workwear shirt and one Dad Cap.",
    options: { label: "Shirt size", choices: ["S", "M", "L", "XL", "XXL"] },
    image: "images/dad.jpg",
    featured: true,
  },
  {
    id: "gift-box",
    name: "Gift Box",
    category: "gifts",
    price: 450,
    size: "Hot honey + card",
    description: "Our hot honey in a branded box with a handwritten card. Ordering 10 or more for your team or clients? Message us.",
    image: "",
    featured: false,
  },
  {
    id: "gift-voucher",
    name: "Gift Voucher",
    category: "gifts",
    price: 250,
    size: "Sent by WhatsApp or email",
    description: "Pizza, merch or a class when they launch – let them choose.",
    options: { label: "Amount", choices: ["R250", "R500", "R1000"], prices: [250, 500, 1000] },
    image: "",
    featured: true,
  },
];
