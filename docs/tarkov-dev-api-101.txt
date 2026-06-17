### Achievement

**In-game achievements players can earn by completing specific objectives.**

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

A unique 24-character hexadecimal identifier for the achievement. Follows a consistent format across all achievements.

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

The display name of the achievement (e.g., "Welcome to Tarkov", "The Kappa Path").

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

Text describing the conditions required to unlock the achievement (e.g., "Neutralize Killa 15 times while playing as a PMC").

[hidden](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

Whether the achievement is hidden from players until unlocked (true) or visible from the start (false).

[playersCompletedPercent](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

Raw percentage of all players who have completed this achievement (e.g., 0.06, 43.48).

[adjustedPlayersCompletedPercent](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

Statistically adjusted percentage that accounts for active players, providing a more representative completion rate. Uses the percentage completion of Welcome to Tarkov as the baseline under the assumption that all active accounts have died once.

[side](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

The game faction or player type this achievement is associated with. Values include "PMC", "All", or "Scavs".

[normalizedSide](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

Lowercase, standardized version of the side field used for consistent sorting and filtering (e.g., "pmc", "all", "scavs").

[rarity](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

The difficulty/rarity tier of the achievement. Values include "Common", "Rare", or "Legendary".

[normalizedRarity](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

Lowercase, standardized version of the rarity field used for consistent sorting and filtering (e.g., "common", "rare", "legendary").

[imageLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

URL to the achievement's image.

### ID

The `ID` scalar type represents a unique identifier, often used to refetch an object or as key for a cache. The ID type appears in a JSON response as a String; however, it is not intended to be human-readable. When expected as an input type, any string (such as `"4"`) or integer (such as `4`) input value will be accepted as an ID.

### String

The `String` scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text.

### Boolean

The `Boolean` scalar type represents `true` or `false`.

### Float

The `Float` scalar type represents signed double-precision fractional values as specified by [IEEE 754](https://en.wikipedia.org/wiki/IEEE_floating_point).

### Ammo

Fields

[item](https://api.tarkov.dev/#): [Item](https://api.tarkov.dev/#)!

[weight](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

[caliber](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[stackMaxSize](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[tracer](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[tracerColor](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[ammoType](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[projectileCount](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[damage](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[armorDamage](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[fragmentationChance](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

[ricochetChance](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

[penetrationChance](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

[penetrationPower](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[penetrationPowerDeviation](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[accuracyModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[recoilModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[initialSpeed](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[lightBleedModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

[heavyBleedModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

[staminaBurnPerDamage](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

Deprecated Fields

[accuracy](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

Deprecated

Use accuracyModifier instead.

[recoil](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

Deprecated

Use recoilModifier instead.

### Int

The `Int` scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1.

### ArmorMaterial

Fields

[id](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[destructibility](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[minRepairDegradation](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[maxRepairDegradation](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[explosionDestructibility](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[minRepairKitDegradation](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[maxRepairKitDegradation](https://api.tarkov.dev/#): [Float]

### AttributeThreshold

Fields

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[requirement](https://api.tarkov.dev/#): [NumberCompare](https://api.tarkov.dev/#)!


### Barter

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[trader](https://api.tarkov.dev/#): [Trader](https://api.tarkov.dev/#)!

[level](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[taskUnlock](https://api.tarkov.dev/#): [Task](https://api.tarkov.dev/#)

[requiredItems](https://api.tarkov.dev/#): [[ContainedItem](https://api.tarkov.dev/#)]!

[rewardItems](https://api.tarkov.dev/#): [[ContainedItem](https://api.tarkov.dev/#)]!

[buyLimit](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

Deprecated Fields

[source](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

Deprecated

Use trader and level instead.

[sourceName](https://api.tarkov.dev/#): [ItemSourceName](https://api.tarkov.dev/#)!

Deprecated

Use trader instead.

[requirements](https://api.tarkov.dev/#): [[PriceRequirement](https://api.tarkov.dev/#)]!

Deprecated

Use level instead.

### BossSpawn

Fields

[boss](https://api.tarkov.dev/#): [MobInfo](https://api.tarkov.dev/#)!

[spawnChance](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

[spawnLocations](https://api.tarkov.dev/#): [[BossSpawnLocation](https://api.tarkov.dev/#)]!

[escorts](https://api.tarkov.dev/#): [[BossEscort](https://api.tarkov.dev/#)]!

[spawnTime](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[spawnTimeRandom](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)

[spawnTrigger](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[switch](https://api.tarkov.dev/#): [MapSwitch](https://api.tarkov.dev/#)

Deprecated Fields

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

Deprecated

Use [boss.name](http://boss.name/) instead.

[normalizedName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

Deprecated

Use boss.normalizedName instead.

### BossEscort

Fields

[boss](https://api.tarkov.dev/#): [MobInfo](https://api.tarkov.dev/#)!

[amount](https://api.tarkov.dev/#): [[BossEscortAmount](https://api.tarkov.dev/#)]

Deprecated Fields

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

Deprecated

Use [boss.name](http://boss.name/) instead.

[normalizedName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

Deprecated

Use boss.normalizedName instead.

### BossEscortAmount

Fields

[count](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[chance](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

### BossSpawnLocation

The chances of spawning in a given location are very rough estimates and may be incaccurate

Fields

[spawnKey](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[chance](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

### ContainedItem

Fields

[item](https://api.tarkov.dev/#): [Item](https://api.tarkov.dev/#)!

[count](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

[quantity](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

[attributes](https://api.tarkov.dev/#): [[ItemAttribute](https://api.tarkov.dev/#)]

### Craft

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[station](https://api.tarkov.dev/#): [HideoutStation](https://api.tarkov.dev/#)!

[level](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[taskUnlock](https://api.tarkov.dev/#): [Task](https://api.tarkov.dev/#)

[duration](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[requiredItems](https://api.tarkov.dev/#): [[ContainedItem](https://api.tarkov.dev/#)]!

[requiredQuestItems](https://api.tarkov.dev/#): [[QuestItem](https://api.tarkov.dev/#)]!

[rewardItems](https://api.tarkov.dev/#): [[ContainedItem](https://api.tarkov.dev/#)]!

Deprecated Fields

[source](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

Deprecated

Use stationLevel instead.

[sourceName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

Deprecated

Use stationLevel instead.

[requirements](https://api.tarkov.dev/#): [[PriceRequirement](https://api.tarkov.dev/#)]!

Deprecated

Use stationLevel instead.

### CustomizationItem

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[customizationType](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[customizationTypeName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[imageLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

Implementations

[CustomizationItemBasic](https://api.tarkov.dev/#)

[CustomizationItems](https://api.tarkov.dev/#)

### CustomizationItemBasic

Implements

[CustomizationItem](https://api.tarkov.dev/#)

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[customizationType](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[customizationTypeName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[imageLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)


### CustomizationItems

Implements

[CustomizationItem](https://api.tarkov.dev/#)

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[customizationType](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[customizationTypeName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[imageLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[items](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]!



### GameProperty

Fields

[key](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[numericValue](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[stringValue](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[arrayValue](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]

[objectValue](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

### FleaMarket

Implements

[Vendor](https://api.tarkov.dev/#)

Fields

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[normalizedName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[minPlayerLevel](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[enabled](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[sellOfferFeeRate](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

[sellRequirementFeeRate](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

[foundInRaidRequired](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)

[reputationLevels](https://api.tarkov.dev/#): [[FleaMarketReputationLevel](https://api.tarkov.dev/#)]!

### FleaMarketReputationLevel

Fields

[offers](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[offersSpecialEditions](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[minRep](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

[maxRep](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

### GameMode

Enum Values

regular

pve

### GoonReport

Fields

[map](https://api.tarkov.dev/#): [Map](https://api.tarkov.dev/#)

[timestamp](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

### HealthEffect

Fields

[bodyParts](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]!

[effects](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]!

[time](https://api.tarkov.dev/#): [NumberCompare](https://api.tarkov.dev/#)

### HealthPart

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[max](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[bodyPart](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

### HideoutStation

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[normalizedName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[imageLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[levels](https://api.tarkov.dev/#): [[HideoutStationLevel](https://api.tarkov.dev/#)]!

[tarkovDataId](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[crafts](https://api.tarkov.dev/#): [[Craft](https://api.tarkov.dev/#)]!

crafts is only available via the hideoutStations query.

### HideoutStationBonus

Fields

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[value](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[passive](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)

[production](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)

[slotItems](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]

[skillName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

### HideoutStationLevel

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[level](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[constructionTime](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[itemRequirements](https://api.tarkov.dev/#): [[RequirementItem](https://api.tarkov.dev/#)]!

[stationLevelRequirements](https://api.tarkov.dev/#): [[RequirementHideoutStationLevel](https://api.tarkov.dev/#)]!

[skillRequirements](https://api.tarkov.dev/#): [[RequirementSkill](https://api.tarkov.dev/#)]!

[traderRequirements](https://api.tarkov.dev/#): [[RequirementTrader](https://api.tarkov.dev/#)]!

[tarkovDataId](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[crafts](https://api.tarkov.dev/#): [[Craft](https://api.tarkov.dev/#)]!

crafts is only available via the hideoutStations query.

[bonuses](https://api.tarkov.dev/#): [[HideoutStationBonus](https://api.tarkov.dev/#)]

### historicalPricePoint

Fields

[price](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[priceMin](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[offerCount](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[offerCountMin](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[timestamp](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

### Item

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[normalizedName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[shortName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[basePrice](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[updated](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[width](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[height](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[backgroundColor](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[iconLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[gridImageLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[baseImageLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[inspectImageLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[image512pxLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[image8xLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[wikiLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[types](https://api.tarkov.dev/#): [[ItemType](https://api.tarkov.dev/#)]!

[avg24hPrice](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[properties](https://api.tarkov.dev/#): [ItemProperties](https://api.tarkov.dev/#)

[conflictingItems](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]

[conflictingSlotIds](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]

[accuracyModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[recoilModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[ergonomicsModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[hasGrid](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)

[blocksHeadphones](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)

[link](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[lastLowPrice](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[changeLast48h](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[changeLast48hPercent](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[low24hPrice](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[high24hPrice](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[lastOfferCount](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[sellFor](https://api.tarkov.dev/#): [[ItemPrice](https://api.tarkov.dev/#)!]

[buyFor](https://api.tarkov.dev/#): [[ItemPrice](https://api.tarkov.dev/#)!]

[containsItems](https://api.tarkov.dev/#): [[ContainedItem](https://api.tarkov.dev/#)]

[category](https://api.tarkov.dev/#): [ItemCategory](https://api.tarkov.dev/#)

[categories](https://api.tarkov.dev/#): [[ItemCategory](https://api.tarkov.dev/#)]!

[bsgCategoryId](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[handbookCategories](https://api.tarkov.dev/#): [[ItemCategory](https://api.tarkov.dev/#)]!

[weight](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[velocity](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[loudness](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[minLevelForFlea](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[usedInTasks](https://api.tarkov.dev/#): [[Task](https://api.tarkov.dev/#)]!

[receivedFromTasks](https://api.tarkov.dev/#): [[Task](https://api.tarkov.dev/#)]!

[bartersFor](https://api.tarkov.dev/#): [[Barter](https://api.tarkov.dev/#)]!

[bartersUsing](https://api.tarkov.dev/#): [[Barter](https://api.tarkov.dev/#)]!

[craftsFor](https://api.tarkov.dev/#): [[Craft](https://api.tarkov.dev/#)]!

[craftsUsing](https://api.tarkov.dev/#): [[Craft](https://api.tarkov.dev/#)]!

[historicalPrices](https://api.tarkov.dev/#): [[historicalPricePoint](https://api.tarkov.dev/#)]

historicalPrices is only available via the item and items queries.

[fleaMarketFee](https://api.tarkov.dev/#)(

price: [Int](https://api.tarkov.dev/#)

intelCenterLevel: [Int](https://api.tarkov.dev/#)

hideoutManagementLevel: [Int](https://api.tarkov.dev/#)

count: [Int](https://api.tarkov.dev/#)

requireAll: [Boolean](https://api.tarkov.dev/#)

): [Int](https://api.tarkov.dev/#)

Deprecated Fields

[categoryTop](https://api.tarkov.dev/#): [ItemCategory](https://api.tarkov.dev/#)

Deprecated

No longer meaningful with inclusion of Item category.

[translation](https://api.tarkov.dev/#)(languageCode: [LanguageCode](https://api.tarkov.dev/#)): [ItemTranslation](https://api.tarkov.dev/#)

Deprecated

Use the lang argument on queries instead.

[traderPrices](https://api.tarkov.dev/#): [[TraderPrice](https://api.tarkov.dev/#)]!

Deprecated

Use sellFor instead.

[bsgCategory](https://api.tarkov.dev/#): [ItemCategory](https://api.tarkov.dev/#)

Deprecated

Use category instead.

[imageLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

Deprecated

Use inspectImageLink instead.

[imageLinkFallback](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

Deprecated

Fallback handled automatically by inspectImageLink.

[iconLinkFallback](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

Deprecated

Fallback handled automatically by iconLink.

[gridImageLinkFallback](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

Deprecated

Fallback handled automatically by gridImageLink.

ItemArmorSlot

Fields

[nameId](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[zones](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]

Implementations

[ItemArmorSlotLocked](https://api.tarkov.dev/#)

[ItemArmorSlotOpen](https://api.tarkov.dev/#)

ItemArmorSlotLocked

Implements

[ItemArmorSlot](https://api.tarkov.dev/#)

Fields

[nameId](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[bluntThroughput](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[class](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[durability](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[repairCost](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[speedPenalty](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[turnPenalty](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[ergoPenalty](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[material](https://api.tarkov.dev/#): [ArmorMaterial](https://api.tarkov.dev/#)

[zones](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]

[armorType](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[baseValue](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[ricochetX](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[ricochetY](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[ricochetZ](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

ItemArmorSlotOpen

Implements

[ItemArmorSlot](https://api.tarkov.dev/#)

Fields

[nameId](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[zones](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]

[allowedPlates](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]

ItemAttribute

Fields

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[value](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

ItemCategory

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[normalizedName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[parent](https://api.tarkov.dev/#): [ItemCategory](https://api.tarkov.dev/#)

[children](https://api.tarkov.dev/#): [[ItemCategory](https://api.tarkov.dev/#)]

[imageLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

Only Handbook categories have image links

[minLevelForFlea](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

Only Handbook categories have minLevelForFlea

ItemFilters

Fields

[allowedCategories](https://api.tarkov.dev/#): [[ItemCategory](https://api.tarkov.dev/#)]!

[allowedItems](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]!

[excludedCategories](https://api.tarkov.dev/#): [[ItemCategory](https://api.tarkov.dev/#)]!

[excludedItems](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]!

ItemPrice

Fields

[vendor](https://api.tarkov.dev/#): [Vendor](https://api.tarkov.dev/#)!

[price](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[currency](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[currencyItem](https://api.tarkov.dev/#): [Item](https://api.tarkov.dev/#)

[priceRUB](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

Deprecated Fields

[source](https://api.tarkov.dev/#): [ItemSourceName](https://api.tarkov.dev/#)

Deprecated

Use vendor instead.

[requirements](https://api.tarkov.dev/#): [[PriceRequirement](https://api.tarkov.dev/#)]!

Deprecated

Use vendor instead.

ItemPropertiesAmmo

Fields

[caliber](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[stackMaxSize](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[tracer](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)

[tracerColor](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[ammoType](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[projectileCount](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[damage](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[armorDamage](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[fragmentationChance](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[ricochetChance](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[penetrationChance](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[penetrationPower](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[penetrationPowerDeviation](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[accuracyModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[recoilModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[initialSpeed](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[lightBleedModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[heavyBleedModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[durabilityBurnFactor](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[heatFactor](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[staminaBurnPerDamage](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[ballisticCoeficient](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[bulletDiameterMilimeters](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[bulletMassGrams](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[misfireChance](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[failureToFeedChance](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

Deprecated Fields

[accuracy](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

Deprecated

Use accuracyModifier instead.

[recoil](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

Deprecated

Use recoilModifier instead.

### ItemPropertiesArmor

Fields

[class](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[durability](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[repairCost](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[speedPenalty](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[turnPenalty](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[ergoPenalty](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[zones](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]

[material](https://api.tarkov.dev/#): [ArmorMaterial](https://api.tarkov.dev/#)

[armorType](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[bluntThroughput](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[armorSlots](https://api.tarkov.dev/#): [[ItemArmorSlot](https://api.tarkov.dev/#)]


ItemPropertiesArmorAttachment

Fields

[class](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[durability](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[repairCost](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[speedPenalty](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[turnPenalty](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[ergoPenalty](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[zones](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]

[material](https://api.tarkov.dev/#): [ArmorMaterial](https://api.tarkov.dev/#)

[armorType](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[blindnessProtection](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[bluntThroughput](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[slots](https://api.tarkov.dev/#): [[ItemSlot](https://api.tarkov.dev/#)]

Deprecated Fields

[headZones](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]

Deprecated

Use zones instead.


ItemPropertiesBackpack

Fields

[capacity](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[grids](https://api.tarkov.dev/#): [[ItemStorageGrid](https://api.tarkov.dev/#)]

[speedPenalty](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[turnPenalty](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[ergoPenalty](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

Deprecated Fields

[pouches](https://api.tarkov.dev/#): [[ItemStorageGrid](https://api.tarkov.dev/#)]

Deprecated

Use grids instead.


ItemPropertiesBarrel

Fields

[ergonomics](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[recoilModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[centerOfImpact](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[deviationCurve](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[deviationMax](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[slots](https://api.tarkov.dev/#): [[ItemSlot](https://api.tarkov.dev/#)]

Deprecated Fields

[recoil](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

Deprecated

Use recoilModifier instead.

[accuracyModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

Deprecated

Use centerOfImpact, deviationCurve, and deviationMax instead.


ItemPropertiesChestRig

Fields

[class](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[durability](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[repairCost](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[speedPenalty](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[turnPenalty](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[ergoPenalty](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[zones](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]

[material](https://api.tarkov.dev/#): [ArmorMaterial](https://api.tarkov.dev/#)

[capacity](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[grids](https://api.tarkov.dev/#): [[ItemStorageGrid](https://api.tarkov.dev/#)]

[armorType](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[bluntThroughput](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[armorSlots](https://api.tarkov.dev/#): [[ItemArmorSlot](https://api.tarkov.dev/#)]

Deprecated Fields

[pouches](https://api.tarkov.dev/#): [[ItemStorageGrid](https://api.tarkov.dev/#)]

Deprecated

Use grids instead.


ItemPropertiesContainer

Fields

[capacity](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[grids](https://api.tarkov.dev/#): [[ItemStorageGrid](https://api.tarkov.dev/#)]


ItemPropertiesFoodDrink

Fields

[energy](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[hydration](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[units](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[stimEffects](https://api.tarkov.dev/#): [[StimEffect](https://api.tarkov.dev/#)]!


ItemPropertiesGlasses

Fields

[class](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[durability](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[repairCost](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[blindnessProtection](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[ergoPenalty](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[material](https://api.tarkov.dev/#): [ArmorMaterial](https://api.tarkov.dev/#)

[bluntThroughput](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)


ItemPropertiesGrenade

Fields

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[fuse](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[minExplosionDistance](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[maxExplosionDistance](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[fragments](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[contusionRadius](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)


ItemPropertiesHeadphone

Fields

[ambientVolume](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[compressorAttack](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[compressorGain](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[compressorRelease](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[compressorThreshold](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[compressorVolume](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[cutoffFrequency](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[distanceModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[distortion](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[dryVolume](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[highFrequencyGain](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[resonance](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)


ItemPropertiesHeadwear

Fields

[slots](https://api.tarkov.dev/#): [[ItemSlot](https://api.tarkov.dev/#)]


ItemPropertiesHelmet

Fields

[class](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[durability](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[repairCost](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[speedPenalty](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[turnPenalty](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[ergoPenalty](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[headZones](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]

[material](https://api.tarkov.dev/#): [ArmorMaterial](https://api.tarkov.dev/#)

[deafening](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[blocksHeadset](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)

[blindnessProtection](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[slots](https://api.tarkov.dev/#): [[ItemSlot](https://api.tarkov.dev/#)]

[ricochetX](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[ricochetY](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[ricochetZ](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[armorType](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[bluntThroughput](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[armorSlots](https://api.tarkov.dev/#): [[ItemArmorSlot](https://api.tarkov.dev/#)]


### ItemPropertiesKey

Fields

[uses](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)


### ItemPropertiesMagazine

Fields

[ergonomics](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[recoilModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[capacity](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[loadModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[ammoCheckModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[malfunctionChance](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[slots](https://api.tarkov.dev/#): [[ItemSlot](https://api.tarkov.dev/#)]

[allowedAmmo](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]

Deprecated Fields

[recoil](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

Deprecated

Use recoilModifier instead.


### ItemPropertiesMedicalItem

Fields

[uses](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[useTime](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[cures](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]


### ItemPropertiesMedKit

Fields

[hitpoints](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[useTime](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[maxHealPerUse](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[cures](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]

[hpCostLightBleeding](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[hpCostHeavyBleeding](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)


### ItemPropertiesMelee

Fields

[slashDamage](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[stabDamage](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[hitRadius](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)


### ItemPropertiesNightVision

Fields

[intensity](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[noiseIntensity](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[noiseScale](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[diffuseIntensity](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)


### ItemPropertiesPainkiller

Fields

[uses](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[useTime](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[cures](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]

[painkillerDuration](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[energyImpact](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[hydrationImpact](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)


### ItemPropertiesPreset

Fields

[baseItem](https://api.tarkov.dev/#): [Item](https://api.tarkov.dev/#)!

[ergonomics](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[recoilVertical](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[recoilHorizontal](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[moa](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[default](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)


### ItemPropertiesResource

Fields

[units](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)


### ItemPropertiesScope

Fields

[ergonomics](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[sightModes](https://api.tarkov.dev/#): [[Int](https://api.tarkov.dev/#)]

[sightingRange](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[recoilModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[slots](https://api.tarkov.dev/#): [[ItemSlot](https://api.tarkov.dev/#)]

[zoomLevels](https://api.tarkov.dev/#): [[[Float](https://api.tarkov.dev/#)]]

Deprecated Fields

[recoil](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

Deprecated

Use recoilModifier instead.


### ItemPropertiesStim

Fields

[useTime](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[cures](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]

[stimEffects](https://api.tarkov.dev/#): [[StimEffect](https://api.tarkov.dev/#)]!


### ItemPropertiesSurgicalKit

Fields

[uses](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[useTime](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[cures](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]

[minLimbHealth](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[maxLimbHealth](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)


### ItemPropertiesWeapon

Fields

[caliber](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[defaultAmmo](https://api.tarkov.dev/#): [Item](https://api.tarkov.dev/#)

[effectiveDistance](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[ergonomics](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[fireModes](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]

[fireRate](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[maxDurability](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[recoilVertical](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[recoilHorizontal](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[repairCost](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[sightingRange](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[centerOfImpact](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[deviationCurve](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[recoilDispersion](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[recoilAngle](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[cameraRecoil](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[cameraSnap](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[deviationMax](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[convergence](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[defaultWidth](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[defaultHeight](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[defaultErgonomics](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[defaultRecoilVertical](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[defaultRecoilHorizontal](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[defaultWeight](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[defaultPreset](https://api.tarkov.dev/#): [Item](https://api.tarkov.dev/#)

[presets](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]

[slots](https://api.tarkov.dev/#): [[ItemSlot](https://api.tarkov.dev/#)]

[allowedAmmo](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]


### ItemPropertiesWeaponMod

Fields

[ergonomics](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[recoilModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[accuracyModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[slots](https://api.tarkov.dev/#): [[ItemSlot](https://api.tarkov.dev/#)]

Deprecated Fields

[recoil](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

Deprecated

Use recoilModifier instead.


ItemProperties

Possible Types

[ItemPropertiesAmmo](https://api.tarkov.dev/#)

[ItemPropertiesArmor](https://api.tarkov.dev/#)

[ItemPropertiesArmorAttachment](https://api.tarkov.dev/#)

[ItemPropertiesBackpack](https://api.tarkov.dev/#)

[ItemPropertiesBarrel](https://api.tarkov.dev/#)

[ItemPropertiesChestRig](https://api.tarkov.dev/#)

[ItemPropertiesContainer](https://api.tarkov.dev/#)

[ItemPropertiesFoodDrink](https://api.tarkov.dev/#)

[ItemPropertiesGlasses](https://api.tarkov.dev/#)

[ItemPropertiesGrenade](https://api.tarkov.dev/#)

[ItemPropertiesHeadwear](https://api.tarkov.dev/#)

[ItemPropertiesHeadphone](https://api.tarkov.dev/#)

[ItemPropertiesHelmet](https://api.tarkov.dev/#)

[ItemPropertiesKey](https://api.tarkov.dev/#)

[ItemPropertiesMagazine](https://api.tarkov.dev/#)

[ItemPropertiesMedicalItem](https://api.tarkov.dev/#)

[ItemPropertiesMelee](https://api.tarkov.dev/#)

[ItemPropertiesMedKit](https://api.tarkov.dev/#)

[ItemPropertiesNightVision](https://api.tarkov.dev/#)

[ItemPropertiesPainkiller](https://api.tarkov.dev/#)

[ItemPropertiesPreset](https://api.tarkov.dev/#)

[ItemPropertiesResource](https://api.tarkov.dev/#)

[ItemPropertiesScope](https://api.tarkov.dev/#)

[ItemPropertiesSurgicalKit](https://api.tarkov.dev/#)

[ItemPropertiesWeapon](https://api.tarkov.dev/#)

[ItemPropertiesWeaponMod](https://api.tarkov.dev/#)

[ItemPropertiesStim](https://api.tarkov.dev/#)


ItemSlot

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[nameId](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[filters](https://api.tarkov.dev/#): [ItemFilters](https://api.tarkov.dev/#)

[required](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)


ItemSourceName

Enum Values

prapor

therapist

fence

skier

peacekeeper

mechanic

ragman

jaeger

ref

fleaMarket


ItemStorageGrid

Fields

[width](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[height](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[filters](https://api.tarkov.dev/#): [ItemFilters](https://api.tarkov.dev/#)!


ItemType

Enum Values

ammo

ammoBox

any

armor

armorPlate

backpack

barter

container

glasses

grenade

gun

headphones

helmet

injectors

keys

markedOnly

meds

mods

noFlea

pistolGrip

poster

preset

provisions

rig

specialSlot

suppressor

wearable


LanguageCode

Enum Values

cs

de

en

es

fr

hu

it

ja

ko

pl

pt

ro

ru

sk

tr

zh


Lock

Fields

[lockType](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[key](https://api.tarkov.dev/#): [Item](https://api.tarkov.dev/#)

[needsPower](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)

[position](https://api.tarkov.dev/#): [MapPosition](https://api.tarkov.dev/#)

[outline](https://api.tarkov.dev/#): [[MapPosition](https://api.tarkov.dev/#)]

[top](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[bottom](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)


LootContainer

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[normalizedName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!


LootContainerPosition

Fields

[lootContainer](https://api.tarkov.dev/#): [LootContainer](https://api.tarkov.dev/#)

[position](https://api.tarkov.dev/#): [MapPosition](https://api.tarkov.dev/#)


LootLoosePosition

Fields

[items](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]

[position](https://api.tarkov.dev/#): [MapPosition](https://api.tarkov.dev/#)


Map

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[tarkovDataId](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[normalizedName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[wiki](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[enemies](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]

[raidDuration](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[players](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[bosses](https://api.tarkov.dev/#): [[BossSpawn](https://api.tarkov.dev/#)]!

[nameId](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[accessKeys](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]!

[accessKeysMinPlayerLevel](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[minPlayerLevel](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[maxPlayerLevel](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[spawns](https://api.tarkov.dev/#): [[MapSpawn](https://api.tarkov.dev/#)]

[extracts](https://api.tarkov.dev/#): [[MapExtract](https://api.tarkov.dev/#)]

[transits](https://api.tarkov.dev/#): [[MapTransit](https://api.tarkov.dev/#)]

[locks](https://api.tarkov.dev/#): [[Lock](https://api.tarkov.dev/#)]

[switches](https://api.tarkov.dev/#): [[MapSwitch](https://api.tarkov.dev/#)]

[hazards](https://api.tarkov.dev/#): [[MapHazard](https://api.tarkov.dev/#)]

[lootContainers](https://api.tarkov.dev/#): [[LootContainerPosition](https://api.tarkov.dev/#)]

[lootLoose](https://api.tarkov.dev/#): [[LootLoosePosition](https://api.tarkov.dev/#)]

[stationaryWeapons](https://api.tarkov.dev/#): [[StationaryWeaponPosition](https://api.tarkov.dev/#)]

[artillery](https://api.tarkov.dev/#): [MapArtillerySettings](https://api.tarkov.dev/#)

[btrStops](https://api.tarkov.dev/#): [[MapPositionNamed](https://api.tarkov.dev/#)]


MapArtillerySettings

Fields

[zones](https://api.tarkov.dev/#): [[MapArtilleryZone](https://api.tarkov.dev/#)]


MapArtilleryZone

Fields

[position](https://api.tarkov.dev/#): [MapPosition](https://api.tarkov.dev/#)

[outline](https://api.tarkov.dev/#): [[MapPosition](https://api.tarkov.dev/#)]

[top](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[bottom](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

Deprecated Fields

[radius](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

Deprecated

Use outline instead.


MapExtract

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[faction](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[switches](https://api.tarkov.dev/#): [[MapSwitch](https://api.tarkov.dev/#)]

[transferItem](https://api.tarkov.dev/#): [ContainedItem](https://api.tarkov.dev/#)

[position](https://api.tarkov.dev/#): [MapPosition](https://api.tarkov.dev/#)

[outline](https://api.tarkov.dev/#): [[MapPosition](https://api.tarkov.dev/#)]

[top](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[bottom](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)


MapHazard

Fields

[hazardType](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[position](https://api.tarkov.dev/#): [MapPosition](https://api.tarkov.dev/#)

[outline](https://api.tarkov.dev/#): [[MapPosition](https://api.tarkov.dev/#)]

[top](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[bottom](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)


MapWithPosition

Fields

[map](https://api.tarkov.dev/#): [Map](https://api.tarkov.dev/#)

[positions](https://api.tarkov.dev/#): [[MapPosition](https://api.tarkov.dev/#)]



MapPositionNamed

Fields

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[x](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

[y](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

[z](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!


MapSpawn

Fields

[zoneName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[position](https://api.tarkov.dev/#): [MapPosition](https://api.tarkov.dev/#)!

[sides](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]

[categories](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]


MapSwitch

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[switchType](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[activatedBy](https://api.tarkov.dev/#): [MapSwitch](https://api.tarkov.dev/#)

[activates](https://api.tarkov.dev/#): [[MapSwitchOperation](https://api.tarkov.dev/#)]

[position](https://api.tarkov.dev/#): [MapPosition](https://api.tarkov.dev/#)



MapSwitch

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[switchType](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[activatedBy](https://api.tarkov.dev/#): [MapSwitch](https://api.tarkov.dev/#)

[activates](https://api.tarkov.dev/#): [[MapSwitchOperation](https://api.tarkov.dev/#)]

[position](https://api.tarkov.dev/#): [MapPosition](https://api.tarkov.dev/#)


MapSwitchOperation

Fields

[operation](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[target](https://api.tarkov.dev/#): [MapSwitchTarget](https://api.tarkov.dev/#)


MapSwitchTarget

Possible Types

[MapSwitch](https://api.tarkov.dev/#)

[MapExtract](https://api.tarkov.dev/#)


MapTransit

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[conditions](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[map](https://api.tarkov.dev/#): [Map](https://api.tarkov.dev/#)

[position](https://api.tarkov.dev/#): [MapPosition](https://api.tarkov.dev/#)

[outline](https://api.tarkov.dev/#): [[MapPosition](https://api.tarkov.dev/#)]

[top](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[bottom](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)


Mastering

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[weapons](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]!

[level2](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[level3](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)


MobInfo

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[normalizedName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[health](https://api.tarkov.dev/#): [[HealthPart](https://api.tarkov.dev/#)]

[imagePortraitLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[imagePosterLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[equipment](https://api.tarkov.dev/#): [[ContainedItem](https://api.tarkov.dev/#)]!

equipment and items are estimates and may be inaccurate.

[items](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]!


NumberCompare

Fields

[compareMethod](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[value](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!


OfferUnlock

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[trader](https://api.tarkov.dev/#): [Trader](https://api.tarkov.dev/#)!

[level](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[item](https://api.tarkov.dev/#): [Item](https://api.tarkov.dev/#)!


PlayerLevel

Fields

[level](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[exp](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[levelBadgeImageLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)


Prestige

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[prestigeLevel](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[imageLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[iconLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[conditions](https://api.tarkov.dev/#): [[TaskObjective](https://api.tarkov.dev/#)]

[rewards](https://api.tarkov.dev/#): [TaskRewards](https://api.tarkov.dev/#)

[transferSettings](https://api.tarkov.dev/#): [[PrestigeTransferSettings](https://api.tarkov.dev/#)]


PrestigeTransferSettings

Possible Types

[PrestigeTransferSettingsStash](https://api.tarkov.dev/#)

[PrestigeTransferSettingsSkill](https://api.tarkov.dev/#)


PrestigeTransferSettingsStash

Fields

[gridWidth](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[gridHeight](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[itemFilters](https://api.tarkov.dev/#): [ItemFilters](https://api.tarkov.dev/#)


PrestigeTransferSettingsSkill

Fields

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[skillType](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[transferRate](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)


PriceRequirement

Fields

[type](https://api.tarkov.dev/#): [RequirementType](https://api.tarkov.dev/#)!

[value](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[stringValue](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)


QuestItem

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[shortName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[normalizedName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[width](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[height](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[iconLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[gridImageLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[baseImageLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[inspectImageLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[image512pxLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[image8xLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)


RequirementHideoutStationLevel

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[station](https://api.tarkov.dev/#): [HideoutStation](https://api.tarkov.dev/#)!

[level](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!


RequirementItem

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[item](https://api.tarkov.dev/#): [Item](https://api.tarkov.dev/#)!

[count](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[quantity](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[attributes](https://api.tarkov.dev/#): [[ItemAttribute](https://api.tarkov.dev/#)]


RequirementSkill

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[skill](https://api.tarkov.dev/#): [Skill](https://api.tarkov.dev/#)!

[level](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!


RequirementTask

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[task](https://api.tarkov.dev/#): [Task](https://api.tarkov.dev/#)!



RequirementTrader

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[trader](https://api.tarkov.dev/#): [Trader](https://api.tarkov.dev/#)!

[requirementType](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[compareMethod](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[value](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

Deprecated Fields

[level](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

Deprecated

Use value instead.


RequirementType

Enum Values

playerLevel

loyaltyLevel

questCompleted

stationLevel


ServerStatus

Fields

[generalStatus](https://api.tarkov.dev/#): [Status](https://api.tarkov.dev/#)

[currentStatuses](https://api.tarkov.dev/#): [[Status](https://api.tarkov.dev/#)]

[messages](https://api.tarkov.dev/#): [[StatusMessage](https://api.tarkov.dev/#)]


Skill

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[imageLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)


SkillLevel

Fields

[skill](https://api.tarkov.dev/#): [Skill](https://api.tarkov.dev/#)!

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[level](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!


StationaryWeapon

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[shortName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)


StationaryWeaponPosition

Fields

[stationaryWeapon](https://api.tarkov.dev/#): [StationaryWeapon](https://api.tarkov.dev/#)

[position](https://api.tarkov.dev/#): [MapPosition](https://api.tarkov.dev/#)


Status

Fields

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[message](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[status](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[statusCode](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!


StatusCode

Enum Values

OK

Updating

Unstable

Down


StatusMessage

Fields

[content](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[time](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[type](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[solveTime](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[statusCode](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!


StimEffect

Fields

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[chance](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

[delay](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[duration](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[value](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

[percent](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[skillName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[skill](https://api.tarkov.dev/#): [Skill](https://api.tarkov.dev/#)


Task

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[tarkovDataId](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[normalizedName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[trader](https://api.tarkov.dev/#): [Trader](https://api.tarkov.dev/#)!

[map](https://api.tarkov.dev/#): [Map](https://api.tarkov.dev/#)

[experience](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[wikiLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[taskImageLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[minPlayerLevel](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[taskRequirements](https://api.tarkov.dev/#): [[TaskStatusRequirement](https://api.tarkov.dev/#)]!

[traderRequirements](https://api.tarkov.dev/#): [[RequirementTrader](https://api.tarkov.dev/#)]!

[availableDelaySecondsMin](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[availableDelaySecondsMax](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[objectives](https://api.tarkov.dev/#): [[TaskObjective](https://api.tarkov.dev/#)]!

[startRewards](https://api.tarkov.dev/#): [TaskRewards](https://api.tarkov.dev/#)

[finishRewards](https://api.tarkov.dev/#): [TaskRewards](https://api.tarkov.dev/#)

[failConditions](https://api.tarkov.dev/#): [[TaskObjective](https://api.tarkov.dev/#)]!

[failureOutcome](https://api.tarkov.dev/#): [TaskRewards](https://api.tarkov.dev/#)

[restartable](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)

[factionName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[requiredPrestige](https://api.tarkov.dev/#): [Prestige](https://api.tarkov.dev/#)

[kappaRequired](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)

[lightkeeperRequired](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)

[descriptionMessageId](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[startMessageId](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[successMessageId](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[failMessageId](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

Deprecated Fields

[neededKeys](https://api.tarkov.dev/#): [[TaskKey](https://api.tarkov.dev/#)]

Deprecated

Use requiredKeys on objectives instead.

[traderLevelRequirements](https://api.tarkov.dev/#): [[RequirementTrader](https://api.tarkov.dev/#)]!

Deprecated

Use traderRequirements instead.


TaskKey

Fields

[keys](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]!

[map](https://api.tarkov.dev/#): [Map](https://api.tarkov.dev/#)


TaskObjective

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[maps](https://api.tarkov.dev/#): [[Map](https://api.tarkov.dev/#)]!

[optional](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

Implementations

[TaskObjectiveBasic](https://api.tarkov.dev/#)

[TaskObjectiveBuildItem](https://api.tarkov.dev/#)

[TaskObjectiveExperience](https://api.tarkov.dev/#)

[TaskObjectiveExtract](https://api.tarkov.dev/#)

[TaskObjectiveHideoutStation](https://api.tarkov.dev/#)

[TaskObjectiveItem](https://api.tarkov.dev/#)

[TaskObjectiveMark](https://api.tarkov.dev/#)

[TaskObjectivePlayerLevel](https://api.tarkov.dev/#)

[TaskObjectiveQuestItem](https://api.tarkov.dev/#)

[TaskObjectiveShoot](https://api.tarkov.dev/#)

[TaskObjectiveSkill](https://api.tarkov.dev/#)

[TaskObjectiveTaskStatus](https://api.tarkov.dev/#)

[TaskObjectiveTraderLevel](https://api.tarkov.dev/#)

[TaskObjectiveTraderStanding](https://api.tarkov.dev/#)

[TaskObjectiveUseItem](https://api.tarkov.dev/#)


TaskObjectiveBasic

Implements

[TaskObjective](https://api.tarkov.dev/#)

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[maps](https://api.tarkov.dev/#): [[Map](https://api.tarkov.dev/#)]!

[optional](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[zones](https://api.tarkov.dev/#): [[TaskZone](https://api.tarkov.dev/#)]

[requiredKeys](https://api.tarkov.dev/#): [[[Item](https://api.tarkov.dev/#)]]


TaskObjectiveBuildItem

Implements

[TaskObjective](https://api.tarkov.dev/#)

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[maps](https://api.tarkov.dev/#): [[Map](https://api.tarkov.dev/#)]!

[optional](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[item](https://api.tarkov.dev/#): [Item](https://api.tarkov.dev/#)!

[containsAll](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]!

[containsCategory](https://api.tarkov.dev/#): [[ItemCategory](https://api.tarkov.dev/#)]!

[attributes](https://api.tarkov.dev/#): [[AttributeThreshold](https://api.tarkov.dev/#)]!

Deprecated Fields

[containsOne](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]!

Deprecated

Use containsCategory instead.


TaskObjectiveExperience

Implements

[TaskObjective](https://api.tarkov.dev/#)

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[count](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[maps](https://api.tarkov.dev/#): [[Map](https://api.tarkov.dev/#)]!

[optional](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[healthEffect](https://api.tarkov.dev/#): [HealthEffect](https://api.tarkov.dev/#)!


TaskObjectiveExtract

Implements

[TaskObjective](https://api.tarkov.dev/#)

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[maps](https://api.tarkov.dev/#): [[Map](https://api.tarkov.dev/#)]!

[optional](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[exitStatus](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]!

[exitName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[zoneNames](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]!

[count](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[requiredKeys](https://api.tarkov.dev/#): [[[Item](https://api.tarkov.dev/#)]]


TaskObjectiveHideoutStation

Implements

[TaskObjective](https://api.tarkov.dev/#)

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[maps](https://api.tarkov.dev/#): [[Map](https://api.tarkov.dev/#)]!

[optional](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[hideoutStation](https://api.tarkov.dev/#): [HideoutStation](https://api.tarkov.dev/#)

[stationLevel](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)


TaskObjectiveItem

Implements

[TaskObjective](https://api.tarkov.dev/#)

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[maps](https://api.tarkov.dev/#): [[Map](https://api.tarkov.dev/#)]!

[optional](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[items](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]!

[count](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[foundInRaid](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[dogTagLevel](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[maxDurability](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[minDurability](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[zones](https://api.tarkov.dev/#): [[TaskZone](https://api.tarkov.dev/#)]

[requiredKeys](https://api.tarkov.dev/#): [[[Item](https://api.tarkov.dev/#)]]

Deprecated Fields

[item](https://api.tarkov.dev/#): [Item](https://api.tarkov.dev/#)!

Deprecated

Use items instead.


TaskObjectiveItem

Implements

[TaskObjective](https://api.tarkov.dev/#)

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[maps](https://api.tarkov.dev/#): [[Map](https://api.tarkov.dev/#)]!

[optional](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[items](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]!

[count](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[foundInRaid](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[dogTagLevel](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[maxDurability](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[minDurability](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[zones](https://api.tarkov.dev/#): [[TaskZone](https://api.tarkov.dev/#)]

[requiredKeys](https://api.tarkov.dev/#): [[[Item](https://api.tarkov.dev/#)]]

Deprecated Fields

[item](https://api.tarkov.dev/#): [Item](https://api.tarkov.dev/#)!

Deprecated

Use items instead.


TaskObjectiveMark

Implements

[TaskObjective](https://api.tarkov.dev/#)

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[maps](https://api.tarkov.dev/#): [[Map](https://api.tarkov.dev/#)]!

[optional](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[markerItem](https://api.tarkov.dev/#): [Item](https://api.tarkov.dev/#)!

[zones](https://api.tarkov.dev/#): [[TaskZone](https://api.tarkov.dev/#)]

[requiredKeys](https://api.tarkov.dev/#): [[[Item](https://api.tarkov.dev/#)]]


TaskObjectivePlayerLevel

Implements

[TaskObjective](https://api.tarkov.dev/#)

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[maps](https://api.tarkov.dev/#): [[Map](https://api.tarkov.dev/#)]!

[optional](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[playerLevel](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!


TaskObjectiveQuestItem

Implements

[TaskObjective](https://api.tarkov.dev/#)

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[maps](https://api.tarkov.dev/#): [[Map](https://api.tarkov.dev/#)]!

[optional](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[questItem](https://api.tarkov.dev/#): [QuestItem](https://api.tarkov.dev/#)!

[count](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[possibleLocations](https://api.tarkov.dev/#): [[MapWithPosition](https://api.tarkov.dev/#)]

[zones](https://api.tarkov.dev/#): [[TaskZone](https://api.tarkov.dev/#)]

[requiredKeys](https://api.tarkov.dev/#): [[[Item](https://api.tarkov.dev/#)]]


TaskObjectiveShoot

Implements

[TaskObjective](https://api.tarkov.dev/#)

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[maps](https://api.tarkov.dev/#): [[Map](https://api.tarkov.dev/#)]!

[optional](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[targetNames](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]!

[count](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[shotType](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[zoneNames](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]!

[bodyParts](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]!

[usingWeapon](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]

[usingWeaponMods](https://api.tarkov.dev/#): [[[Item](https://api.tarkov.dev/#)]]

[wearing](https://api.tarkov.dev/#): [[[Item](https://api.tarkov.dev/#)]]

[notWearing](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]

[distance](https://api.tarkov.dev/#): [NumberCompare](https://api.tarkov.dev/#)

[playerHealthEffect](https://api.tarkov.dev/#): [HealthEffect](https://api.tarkov.dev/#)

[enemyHealthEffect](https://api.tarkov.dev/#): [HealthEffect](https://api.tarkov.dev/#)

[timeFromHour](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[timeUntilHour](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[zones](https://api.tarkov.dev/#): [[TaskZone](https://api.tarkov.dev/#)]

[requiredKeys](https://api.tarkov.dev/#): [[[Item](https://api.tarkov.dev/#)]]

Deprecated Fields

[target](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

Deprecated

Use targetNames instead.


TaskObjectiveSkill

Implements

[TaskObjective](https://api.tarkov.dev/#)

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[maps](https://api.tarkov.dev/#): [[Map](https://api.tarkov.dev/#)]!

[optional](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[skillLevel](https://api.tarkov.dev/#): [SkillLevel](https://api.tarkov.dev/#)!


TaskObjectiveTaskStatus

Implements

[TaskObjective](https://api.tarkov.dev/#)

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[maps](https://api.tarkov.dev/#): [[Map](https://api.tarkov.dev/#)]!

[optional](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[task](https://api.tarkov.dev/#): [Task](https://api.tarkov.dev/#)!

[status](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]!


TaskObjectiveTraderLevel

Implements

[TaskObjective](https://api.tarkov.dev/#)

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[maps](https://api.tarkov.dev/#): [[Map](https://api.tarkov.dev/#)]!

[optional](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[trader](https://api.tarkov.dev/#): [Trader](https://api.tarkov.dev/#)!

[level](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!




TaskObjectiveUseItem

Implements

[TaskObjective](https://api.tarkov.dev/#)

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[maps](https://api.tarkov.dev/#): [[Map](https://api.tarkov.dev/#)]!

[optional](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)!

[useAny](https://api.tarkov.dev/#): [[Item](https://api.tarkov.dev/#)]!

[compareMethod](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[count](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[zoneNames](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]!

[zones](https://api.tarkov.dev/#): [[TaskZone](https://api.tarkov.dev/#)]

[requiredKeys](https://api.tarkov.dev/#): [[[Item](https://api.tarkov.dev/#)]]


TaskRewards

Fields

[traderStanding](https://api.tarkov.dev/#): [[TraderStanding](https://api.tarkov.dev/#)]!

[items](https://api.tarkov.dev/#): [[ContainedItem](https://api.tarkov.dev/#)]!

[offerUnlock](https://api.tarkov.dev/#): [[OfferUnlock](https://api.tarkov.dev/#)]!

[skillLevelReward](https://api.tarkov.dev/#): [[SkillLevel](https://api.tarkov.dev/#)]!

[traderUnlock](https://api.tarkov.dev/#): [[Trader](https://api.tarkov.dev/#)]!

[craftUnlock](https://api.tarkov.dev/#): [[Craft](https://api.tarkov.dev/#)]!

[achievement](https://api.tarkov.dev/#): [[Achievement](https://api.tarkov.dev/#)]!

[customization](https://api.tarkov.dev/#): [[CustomizationItem](https://api.tarkov.dev/#)


TaskStatusRequirement

Fields

[task](https://api.tarkov.dev/#): [Task](https://api.tarkov.dev/#)!

[status](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]!



TaskZone

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[map](https://api.tarkov.dev/#): [Map](https://api.tarkov.dev/#)

[position](https://api.tarkov.dev/#): [MapPosition](https://api.tarkov.dev/#)

[outline](https://api.tarkov.dev/#): [[MapPosition](https://api.tarkov.dev/#)]

[top](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[bottom](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)


Trader

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[normalizedName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[resetTime](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[currency](https://api.tarkov.dev/#): [Item](https://api.tarkov.dev/#)!

[discount](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

[levels](https://api.tarkov.dev/#): [[TraderLevel](https://api.tarkov.dev/#)!]!

[reputationLevels](https://api.tarkov.dev/#): [[TraderReputationLevel](https://api.tarkov.dev/#)]!

[barters](https://api.tarkov.dev/#): [[Barter](https://api.tarkov.dev/#)]!

barters and cashOffers are only available via the traders query.

[cashOffers](https://api.tarkov.dev/#): [[TraderCashOffer](https://api.tarkov.dev/#)]!

[imageLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[image4xLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[tarkovDataId](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)


TraderLevel

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)!

[level](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[requiredPlayerLevel](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[requiredReputation](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

[requiredCommerce](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[payRate](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

[insuranceRate](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[repairCostMultiplier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[barters](https://api.tarkov.dev/#): [[Barter](https://api.tarkov.dev/#)]!

barters and cashOffers are only available via the traders query.

[cashOffers](https://api.tarkov.dev/#): [[TraderCashOffer](https://api.tarkov.dev/#)]!

[imageLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[image4xLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)


TraderCashOffer

Fields

[id](https://api.tarkov.dev/#): [ID](https://api.tarkov.dev/#)

[item](https://api.tarkov.dev/#): [Item](https://api.tarkov.dev/#)!

[minTraderLevel](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[price](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[currency](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

[currencyItem](https://api.tarkov.dev/#): [Item](https://api.tarkov.dev/#)

[priceRUB](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[taskUnlock](https://api.tarkov.dev/#): [Task](https://api.tarkov.dev/#)

[buyLimit](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)



TraderName

Enum Values

prapor

therapist

fence

skier

peacekeeper

mechanic

ragman

jaeger

ref


TraderOffer

Implements

[Vendor](https://api.tarkov.dev/#)

Fields

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[normalizedName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[trader](https://api.tarkov.dev/#): [Trader](https://api.tarkov.dev/#)!

[minTraderLevel](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[taskUnlock](https://api.tarkov.dev/#): [Task](https://api.tarkov.dev/#)

[buyLimit](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)


TraderReputationLevel

Possible Types

[TraderReputationLevelFence](https://api.tarkov.dev/#)


TraderReputationLevelFence

Fields

[minimumReputation](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

[scavCooldownModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[scavCaseTimeModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[extractPriceModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[scavFollowChance](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[scavEquipmentSpawnChanceModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[priceModifier](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)

[hostileBosses](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)

[hostileScavs](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)

[scavAttackSupport](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)

[availableScavExtracts](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[btrEnabled](https://api.tarkov.dev/#): [Boolean](https://api.tarkov.dev/#)

[btrDeliveryDiscount](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[btrDeliveryGridSize](https://api.tarkov.dev/#): [MapPosition](https://api.tarkov.dev/#)

[btrTaxiDiscount](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[btrCoveringFireDiscount](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)



TraderStanding

Fields

[trader](https://api.tarkov.dev/#): [Trader](https://api.tarkov.dev/#)!

[standing](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!



Vendor

Fields

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

[normalizedName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

Implementations

[FleaMarket](https://api.tarkov.dev/#)

[TraderOffer](https://api.tarkov.dev/#)



ItemTranslation

The below types are all deprecated and may not return current data. ItemTranslation has been replaced with the lang argument on all queries

Deprecated Fields

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

Deprecated

Use the lang argument on queries instead.

[shortName](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

Deprecated

Use the lang argument on queries instead.

[description](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

Deprecated

Use the lang argument on queries instead.



HideoutModule

HideoutModule has been replaced with HideoutStation.

Fields

[level](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

[itemRequirements](https://api.tarkov.dev/#): [[ContainedItem](https://api.tarkov.dev/#)]!

[moduleRequirements](https://api.tarkov.dev/#): [[HideoutModule](https://api.tarkov.dev/#)]!

Deprecated Fields

[id](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

Deprecated

Use HideoutStation type instead.

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

Deprecated

Use HideoutStation type instead.



Quest

Quest has been replaced with Task.

Deprecated Fields

[id](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

Deprecated

Use Task type instead.

[requirements](https://api.tarkov.dev/#): [QuestRequirement](https://api.tarkov.dev/#)

Deprecated

Use Task type instead.

[giver](https://api.tarkov.dev/#): [Trader](https://api.tarkov.dev/#)!

Deprecated

Use Task type instead.

[turnin](https://api.tarkov.dev/#): [Trader](https://api.tarkov.dev/#)!

Deprecated

Use Task type instead.

[title](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

Deprecated

Use Task type instead.

[wikiLink](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

Deprecated

Use Task type instead.

[exp](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

Deprecated

Use Task type instead.

[unlocks](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)]!

Deprecated

Use Task type instead.

[reputation](https://api.tarkov.dev/#): [[QuestRewardReputation](https://api.tarkov.dev/#)!]

Deprecated

Use Task type instead.

[objectives](https://api.tarkov.dev/#): [[QuestObjective](https://api.tarkov.dev/#)]!

Deprecated

Use Task type instead.




QuestObjective

QuestObjective has been replaced with TaskObjective.

Deprecated Fields

[id](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

Deprecated

Use Task type instead.

[type](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

Deprecated

Use Task type instead.

[target](https://api.tarkov.dev/#): [[String](https://api.tarkov.dev/#)!]

Deprecated

Use Task type instead.

[targetItem](https://api.tarkov.dev/#): [Item](https://api.tarkov.dev/#)

Deprecated

Use Task type instead.

[number](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

Deprecated

Use Task type instead.

[location](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

Deprecated

Use Task type instead.




QuestRequirement

QuestRequirement has been replaced with TaskRequirement.

Deprecated Fields

[level](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)

Deprecated

Use Task type instead.

[quests](https://api.tarkov.dev/#): [[[Int](https://api.tarkov.dev/#)]]!

Deprecated

Use Task type instead.

[prerequisiteQuests](https://api.tarkov.dev/#): [[[Quest](https://api.tarkov.dev/#)]]!

Deprecated

Use Task type instead.




QuestRewardReputation

Deprecated Fields

[trader](https://api.tarkov.dev/#): [Trader](https://api.tarkov.dev/#)!

Deprecated

Use Task type instead.

[amount](https://api.tarkov.dev/#): [Float](https://api.tarkov.dev/#)!

Deprecated

Use Task type instead.



TraderPrice

TraderPrice is deprecated and replaced with ItemPrice.

Deprecated Fields

[price](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

Deprecated

Use item.buyFor instead.

[currency](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)!

Deprecated

Use item.buyFor instead.

[priceRUB](https://api.tarkov.dev/#): [Int](https://api.tarkov.dev/#)!

Deprecated

Use item.buyFor instead.

[trader](https://api.tarkov.dev/#): [Trader](https://api.tarkov.dev/#)!

Deprecated

Use item.buyFor instead.




TraderResetTime

TraderResetTime is deprecated and replaced with Trader.

Deprecated Fields

[name](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

Deprecated

Use [Trader.name](http://trader.name/) type instead.

[resetTimestamp](https://api.tarkov.dev/#): [String](https://api.tarkov.dev/#)

Deprecated

Use Trader.resetTime type instead.