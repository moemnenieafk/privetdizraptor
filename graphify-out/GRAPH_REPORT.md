# Graph Report - cta-project  (2026-06-17)

## Corpus Check
- 244 files · ~115,192 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 83 nodes · 129 edges · 9 communities (8 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8e679b9e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]

## God Nodes (most connected - your core abstractions)
1. `useQuestStore` - 9 edges
2. `TaskRaw` - 9 edges
3. `QuestDrawer()` - 4 edges
4. `QuestNodeComponent()` - 4 edges
5. `TaskObjective` - 4 edges
6. `traderImg()` - 3 edges
7. `ObjectiveRow()` - 3 edges
8. `QuestFilterBar()` - 3 edges
9. `getQuestMapTasks()` - 3 edges
10. `QuestNodeStatus` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Props` --references--> `TaskRaw`  [EXTRACTED]
  src/app/eft/progress/quests/QuestMapClient.tsx → src/types/quest.ts
- `QuestMapClient()` --calls--> `useQuestStore`  [EXTRACTED]
  src/app/eft/progress/quests/QuestMapClient.tsx → src/store/useQuestStore.ts
- `QuestDrawer()` --calls--> `useQuestStore`  [EXTRACTED]
  src/components/features/quests/QuestDrawer/index.tsx → src/store/useQuestStore.ts
- `Props` --references--> `TaskRaw`  [EXTRACTED]
  src/components/features/quests/QuestFilterBar/index.tsx → src/types/quest.ts
- `QuestNodeComponent()` --calls--> `useQuestStore`  [EXTRACTED]
  src/components/features/quests/QuestNode/index.tsx → src/store/useQuestStore.ts

## Import Cycles
- None detected.

## Communities (9 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (9): CommsHub(), CommsHubProps, SOCIAL_LINKS, FALLBACK_VIDEOS, FEATURE_CARDS, HomeClient(), HomeClientProps, SupplyGrid() (+1 more)

### Community 1 - "Community 1"
Cohesion: 0.16
Nodes (16): BTN_LABEL, getOpacityCls(), QuestNode, QuestNodeComponent(), STATUS_BTN, STATUS_CARD_BASE, TRADER_SLUG, traderImg() (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.24
Nodes (6): AmmoItem, EftItem, getQuestMapTasks(), QuestsMapPage(), QuestMapClient, QuestMapDynamic()

### Community 3 - "Community 3"
Cohesion: 0.22
Nodes (3): nodeTypes, StatusEntry, TRADER_SLUG

### Community 4 - "Community 4"
Cohesion: 0.36
Nodes (7): getObjIcon(), OBJECTIVE_ICON, ObjectiveRow(), Props, QuestDrawer(), TRADER_SLUG, traderImg()

### Community 5 - "Community 5"
Cohesion: 0.33
Nodes (5): MapEntry, Props, TRADER_SLUG, Props, TaskRaw

### Community 6 - "Community 6"
Cohesion: 0.40
Nodes (3): exportProgress(), importProgress(), QuestStore

### Community 8 - "Community 8"
Cohesion: 0.67
Nodes (3): QuestFilterBar(), QuestMapClient(), useQuestStore

## Knowledge Gaps
- **25 isolated node(s):** `TRADER_SLUG`, `nodeTypes`, `StatusEntry`, `QuestMapClient`, `CommsHubProps` (+20 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TaskRaw` connect `Community 5` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 6`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `useQuestStore` connect `Community 8` to `Community 1`, `Community 3`, `Community 4`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `TRADER_SLUG`, `nodeTypes`, `StatusEntry` to the rest of the system?**
  _25 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.13071895424836602 - nodes in this community are weakly interconnected._