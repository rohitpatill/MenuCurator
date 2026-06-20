// Filter definitions and defaults shared across screens.

export const FILTER_GROUPS = [
  { key: "budget", title: "Budget", opts: ["Up to ₹1000", "Up to ₹2000", "Up to ₹5000", "Up to ₹10,000", "No limits"] },
  { key: "veg", title: "Preference", opts: ["Veg", "Non-veg", "Both", "Jain"] },
  { key: "party", title: "Party size", opts: ["2–3", "5–6", "Custom"] },
  { key: "drinks", title: "Drinks", opts: ["None", "Mocktails", "Cocktails", "Both"] },
  { key: "course", title: "Course", opts: ["Starters", "Main course", "Desserts", "Full meal"] },
  { key: "cuisine", title: "Cuisine", opts: ["Indian", "Chinese", "Continental", "Italian", "Any"] },
  { key: "spice", title: "Spice level", opts: ["Mild", "Medium", "Spicy"] },
];

export const EXTRA_CHIPS = [
  ["light", "Light bite"],
  ["hearty", "Hearty meal"],
  ["nut", "Nut-free"],
  ["dairy", "Dairy-free"],
  ["gluten", "Gluten-free"],
  ["nog", "No onion-garlic"],
  ["hot", "Tea / Coffee"],
  ["best", "Bestsellers only"],
  ["chef", "Chef's specials"],
];

export const DEFAULT_FILTERS = {
  budget: "Up to ₹2000",
  veg: "Both",
  party: "2–3",
  drinks: "None",
  course: "Full meal",
  cuisine: "Any",
  spice: "Medium",
};

export function partySize(party, custom) {
  return party === "5–6" ? 6 : party === "Custom" ? custom || 4 : 3;
}

export const SUGGESTED_DISH_QS = [
  ["What's in it?", "What does it contain?"],
  ["How many pieces?", "How many pieces?"],
  ["Enough for 3?", "Is it enough for 3 of us?"],
  ["How spicy?", "How spicy is it?"],
  ["Veg or Jain?", "Is it veg or Jain?"],
];

export const SUGGESTED_REFINE_QS = [
  ["Is this enough for us?", "Is this enough for our group?"],
  ["Suggest a dessert", "Can you suggest a dessert that suits us?"],
  ["What pairs well?", "What would pair well with these?"],
  ["Anything better?", "Is there anything I should swap for something better?"],
];
