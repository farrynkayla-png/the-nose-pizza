// ------------------------------------------------------------
// Pizzas for the "Can't decide?" picker
// Copied from the Storekit menu – keep in sync when the menu changes.
//
// image: the pizza's photo from Storekit (right-click the photo on the Storekit
//        menu → copy image address). If a photo is changed in Storekit, update it here.
// plu:   the item's PLU code in Storekit – used to put the pizza straight into the basket
// tip:   optional add-on suggestion shown with the pick (mention honey to offer "with hot honey")
// ------------------------------------------------------------
(function () {
  function photo(id) { return "https://ucarecdn.com/" + id + "/-/resize/576x/-/format/auto/"; }

  window.PIZZAS = [
    { name: "Classic Margherita", plu: "14", description: "Fresh basil, mozzarella & oregano. The OG.", image: photo("0677bb21-2114-4300-a185-dee85adc4968") },
    { name: "Marinara", plu: "105", description: "Classic Neapolitan with fresh basil, garlic & oregano. No cheese, all flavour.", image: photo("b54581c0-cc21-4f43-8500-7afe91c73548") },
    { name: "Bacon, Avo & Danish Feta", plu: "86", description: "Crispy bacon, avo & Danish feta on a tomato base with mozzarella.", image: photo("11a598ca-caf7-4cd2-9141-d052a0609e4e") },
    { name: "Meaty", plu: "21", description: "Salami & bacon on a tomato base with mozzarella.", image: photo("06e6fbac-7e49-4e27-9698-a9e57fbd2b77") },
    { name: "Seafood", plu: "36", description: "Calamari, mussel, prawn & crabstick with mozzarella & oregano.", image: photo("7560cbaa-802f-4fb7-8269-6163c4298c94") },
    { name: "Salami & Gorgonzola", plu: "18", description: "Authentic salami with gorgonzola & mozzarella.", image: photo("e64e8013-9d82-4ef0-8087-f88677822761") },
    { name: "Pepperoni & Gorgonzola", plu: "70", description: "Pepperoni with gorgonzola & mozzarella.", tip: "Add a drizzle of chilli-infused honey.", image: photo("e8d17ba7-f614-4a72-afde-8940806cfb7f") },
    { name: "Pepperoni", plu: "22", description: "Pepperoni, mozzarella & oregano.", tip: "Add a drizzle of chilli-infused honey. Trust us.", image: photo("28dcb08f-1ac5-4dbd-8a5b-87b5903be235") },
    { name: "Pepperoni, Olive & Avo", plu: "80", description: "Pepperoni, olives & avo with mozzarella & oregano.", image: photo("30c9493a-676b-4964-a248-3da05065db34") },
    { name: "Salami, Olive & Avo", plu: "79", description: "Salami, olives & avo with mozzarella & oregano.", image: photo("6fd82ae8-3f80-4042-8d06-0aec3448cf71") },
    { name: "Romana", plu: "99", description: "Ham on a tomato base with mozzarella & oregano.", image: photo("e79decdd-64ba-4ce5-83f1-2748efffb0bc") },
    { name: "Four Cheese", plu: "98", description: "Feta, gorgonzola, burrata & pecorino with fresh parsley.", image: photo("4822268b-07ef-4dc8-9c62-ef8145b245d5") },
    { name: "Cherry Tomato, Red Onion & Peppers", plu: "32", description: "Cherry tomato, red onion & peppers with mozzarella & oregano.", image: photo("24cc9d8b-3f4c-4669-8629-6fe0893e6adb") },
    { name: "Quattro Stagioni", plu: "103", description: "The classic four seasons: artichokes, olives, mushroom & ham.", image: photo("a22c27f4-4432-4ef5-aefc-1393066016d0") },
    { name: "Artichoke & Olive", plu: "23", description: "Kalamata olives & marinated artichokes with mozzarella.", image: photo("f13721f7-b3a1-45b7-b657-bdbe4a4d9f17") },
    { name: "Eppie's Pizza", plu: "27", description: "Artichokes with anchovy, capers, chilli & garlic.", tip: "Named after the man himself.", image: photo("9937c633-99e5-465f-80e1-4f566ef389ef") },
    { name: "Anchovy, Olives & Capers", plu: "29", description: "Anchovies, olives & capers with mozzarella & oregano.", image: photo("240a6b65-1a38-4586-8f23-f149ebcca2e1") },
    { name: "Focaccia", plu: "28", description: "Garlic & sea salt focaccia with fresh parsley. Cheese-free option for our vegan friends.", image: photo("f9ff6531-80ec-4f08-902c-1581c8d2a918") },
    { name: "Crispy Bacon & Avo", plu: "13", description: "Crispy bacon & avo (seasonal) with mozzarella & oregano.", image: photo("fe8a0939-fcc3-4dcd-a336-8741e8c434fd") },
    { name: "Bacon & Mushroom", plu: "88", description: "Bacon & mushroom with mozzarella & oregano.", image: photo("e5c6137f-53e0-4c87-9819-806fbb096098") },
    { name: "Olives, Red Onion & Avo", plu: "30", description: "Kalamata olives, red onion & avo with mozzarella.", image: photo("63c31d8e-6826-409d-9ab1-8470d3b4dab3") },
    { name: "Salami & Mushroom", plu: "25", description: "Salami & mushroom with mozzarella & oregano.", image: photo("8a82a042-e6da-4673-92c2-37d851191684") },
    { name: "Pepperoni & Mushroom", plu: "31", description: "Pepperoni & mushroom with mozzarella & oregano.", tip: "Add a drizzle of chilli-infused honey.", image: photo("4d8b6700-e4de-480c-a3a8-dc9cb6bbe435") },
    { name: "Regina", plu: "102", description: "Ham & mushroom with mozzarella & oregano.", image: photo("2b2f663f-667d-4312-9ac6-b4671e30c030") },
    { name: "Pepperoni, Mushroom & Olive", plu: "35", description: "Pepperoni, mushrooms & olives with mozzarella.", image: photo("83892364-b4b0-45ec-b0d1-9c973402e146") },
    { name: "Pepperoni, Mushroom & Red Onion", plu: "24", description: "Pepperoni, mushroom & red onion with mozzarella.", image: photo("f1f5d32c-3acc-46a4-9edd-80dc02172cf8") },
    { name: "Salami, Mushroom & Olive", plu: "33", description: "Salami, mushrooms & olives with mozzarella.", image: photo("38774d32-6181-4531-8c52-2a14e187a9d1") },
  ];
})();
