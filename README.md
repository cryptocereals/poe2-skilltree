# PoE1 & PoE2 Skill Tree Planner

An interactive passive skill tree planner for **Path of Exile 1** and **Path of Exile 2**.
Plan a full PoE2 build or allocate PoE1 passives with path previews and pruning.

Live: **https://cryptocereals.github.io/poe2-skilltree/** *(if deployed via GitHub Pages)*

---

## Features

- Global PoE1 / PoE2 switch for the selected workspace
- PoE1 passive allocation with path previews and branch pruning
- PoE1 class and ascendancy allocation, node search/details, pan and zoom
- Combined PoE1 version/ruleset dataset selection and cross-dataset comparison
- Select the current tree or any available archived version
- Optional passive-node comparison between any two available versions or PoE1 rulesets
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

### Workspace navigation

Use the header to switch between **PoE1** and **PoE2**. The selection applies to both workspace destinations. Use the sidebar to switch between **Skill Tree** and **Atlas Tree**. Atlas Tree remains a coming-soon placeholder because no atlas viewer is implemented yet.

On the PoE1 **Skill Tree**, choose a version/ruleset dataset, then select a class or ascendancy. Click passives to allocate or remove them; disconnected branches are pruned. Allocate a notable in a cluster before choosing its mastery effect. The passive summary totals numeric base stats and shows chosen mastery effects verbatim; it does not simulate conditional or enemy effects, quest rewards, or build validity.

### Browsing the tree

Open the app and choose **PoE1** or **PoE2** in the header.

For PoE1, select a combined version/ruleset entry (for example, the current release with **Standard** or **Ruthless**) from **Tree dataset**. Comparison can use any other available dataset, including another ruleset from the same release. Hover a passive to preview its allocation path and see official stats/release changes; click to allocate or deallocate it. Click a mastery to choose one of its effects; canceling does not allocate it, and an allocated mastery can be changed, cleared, or removed. Touch users can tap once to inspect and tap again to allocate or open a mastery choice.

For PoE2, use the **Class Panel** on the right to pick a class.
Pan with left-click drag, zoom with the scroll wheel.
Use the **Search** box on the left to find passives by name.
Use **Tree version** to choose a tree; turn on **Compare with another version** to highlight its differences.

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

PoE1 tree JSON and sprite atlases are downloaded from the official [Grinding Gear Games skilltree-export repository](https://github.com/grindinggear/skilltree-export). Standard and Ruthless remain separate rulesets; the downloader archives the ten latest distinct `data.json` history revisions, including previews and letter releases. Historical JSON and version-scoped runtime atlases are stored under `data/poe1/versions/<snapshot>/` and `assets/poe1/versions/<snapshot>/`, so identical filenames from different snapshots cannot collide.

PoE2 tree data is extracted from the game files and archived exports.
Gem lists are sourced from [poe2db.tw](https://poe2db.tw).
See `app/scripts/` for the data preparation scripts.
Skill-tree sprite atlas metadata and images are paired in `assets/skill-tree/`.

To download tree data:
- Run the VS Code task **Download PoE2 Skill Tree Data** to fetch PoE2 archives.
- Or run `node scripts/skill-tree/download.mjs` from the workspace root.
- Run the VS Code task **Download PoE1 Skill Tree Data (Standard + Ruthless + Assets)**, or run `node scripts/skill-tree/download-poe1.mjs`. It downloads the current Standard/Ruthless export and the ten latest distinct `data.json` revisions; the preparation step publishes them in upstream history order as selectable/comparable snapshots offline.

PoE2 archives are saved to `data/skill-tree/<version>.json`. PoE1 files are pinned to an upstream commit in `data/poe1/manifest.json`; valid local files are skipped on rerun.
