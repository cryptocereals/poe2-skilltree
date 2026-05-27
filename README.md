# PoE2 Skill Tree Planner

An interactive passive skill tree planner for **Path of Exile 2**.
Browse the tree, build your passive allocation, document your gem setup and gear, then export a shareable `.build` file.

Live: **https://cryptocereals.github.io/poe2-skilltree/** *(if deployed via GitHub Pages)*

---

## Features

- Interactive passive skill tree (versions 0.4 and 0.5)
- Class and ascendancy selection
- Weapon set switching (Set I / Set II)
- Build planner wizard (Details → Passives → Skills → Inventory)
- Export / import `.build` files (JSON)
- Path of Building (PoB) paste import
- Passive node diff between versions
- Passive node notes with rich markup
- Gem autocomplete (skill gems and support gems)
- Inventory slot notes

---

## How to use

### Browsing the tree

Open the app. Use the **Class Panel** on the right to pick a class.
Pan with left-click drag, zoom with the scroll wheel.
Use the **Search** box on the left to find passives by name.

### Creating a build

1. Click **New Build** (or **Edit Build** if a class is already selected).
2. The **Build Planner** wizard opens with four steps:

#### Step 1 — Details
Fill in the build name, author, and description.
Select your **class** and **ascendancy**.

#### Step 2 — Passives
Click nodes on the tree to allocate / deallocate them.
Use the **weapon set** toggle to switch between Set I and Set II nodes.
Add notes to any notable or keystone by clicking the node while it is allocated.

#### Step 3 — Skills
Add skill gems by typing in the gem name field (autocomplete available).
Under each skill gem, add support gems with **+ support**.
Use the note field below each gem or support for priority hints and additional context.

Markup supported in notes (right-click the text field for shortcuts):
- `<red>{text}` — red text
- `<green>{text}` — green text
- `<silver>{text}` — silver text
- `<grey>{text}` — grey text
- `**text**` — bold
- `\n` — new line

#### Step 4 — Inventory
Add notes for each inventory slot (weapon, armour, rings, etc.).
Describe the item type, stat priorities, or any unique items to target.

### Exporting a build

Click **Export .build** (or the **Export** button in the wizard header).
A `.build` JSON file will be downloaded.

### Importing a build

Drag and drop a `.build` file onto the app, or use the import button in the Class Panel.
Paste a **Path of Building** export string to auto-import gems and passive allocation.

---

## .build file format

```json
{
  "Build": {
    "name": "My Build",
    "author": "Author",
    "description": "Short description",
    "ascendancy": "Druid1",
    "passives": ["node_id1", "node_id2"],
    "skills": [
      {
        "id": "Metadata/Items/Gems/SkillGemBonestorm",
        "additional_text": "Optional note",
        "support_skills": [
          {
            "id": "Metadata/Items/Gems/SupportGemBrutalityOne",
            "additional_text": "Optional note"
          }
        ]
      }
    ],
    "inventory_slots": [
      {
        "inventory_id": "Weapon1",
        "additional_text": "<silver>{Any Two Handed Mace}\n\n<grey>{Stat Priority\n1. Highest physical DPS}"
      },
      {
        "inventory_id": "BodyArmour1",
        "additional_text": "<red>{Armour (Str Base)}"
      }
    ]
  }
}
```

**Supported `inventory_id` values:** `Weapon1`, `Helm1`, `BodyArmour1`, `Gloves1`, `Boots1`, `Amulet1`, `Ring1`, `Ring2`, `Belt1`

---

## Running locally

```bash
cd app
npm install
npm run dev
```

Then open `http://localhost:5173`.

---

## Data sources

Tree data is extracted from the game files.
Gem lists are sourced from [poe2db.tw](https://poe2db.tw).
See `app/scripts/` for the data preparation scripts.
