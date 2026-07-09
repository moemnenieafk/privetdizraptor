// Чистая математика оверлея «стэш гасит нужду».
// Стэш тратится ОДИН раз: сначала на убежище (FiR не требует), затем на не-FiR
// квест-нужду. FiR-нужда стэшем не гасится — её нужно найти в рейде.
// Решение: docs/decisions/stash-overlay.md

export interface StashNeedInput {
  /** Всего этого предмета в стэше (useInventoryStore.ownedItems[id]). */
  stash: number;
  /** Нужно для убежища — уровни выше уже построенных. */
  hideoutNeed: number;
  /** Не-FiR квест-нужда: Σ(needed − found) по не-FiR целям активных квестов. */
  questSoftNeed: number;
  /** FiR квест-нужда: Σ(needed − found) по FiR-целям. Стэшем не гасится. */
  questFirNeed: number;
}

export interface StashOverlay {
  stash: number;
  hideoutNeed: number;
  questSoftNeed: number;
  questFirNeed: number;
  /** Сколько стэша зачлось убежищу. */
  stashToHideout: number;
  /** Сколько стэша зачлось не-FiR квестам (после убежища). */
  stashToQuest: number;
  /** Докупить/собрать для убежища с учётом стэша. */
  hideoutToObtain: number;
  /** Докупить для не-FiR квестов с учётом стэша. */
  questSoftToObtain: number;
  /** Лишний стэш сверх всей мягкой нужды. */
  surplus: number;
}

export function computeStashOverlay(input: StashNeedInput): StashOverlay {
  const stash = Math.max(0, input.stash);
  const hideoutNeed = Math.max(0, input.hideoutNeed);
  const questSoftNeed = Math.max(0, input.questSoftNeed);
  const questFirNeed = Math.max(0, input.questFirNeed);

  const stashToHideout = Math.min(stash, hideoutNeed);
  const afterHideout = stash - stashToHideout;
  const stashToQuest = Math.min(afterHideout, questSoftNeed);
  const surplus = Math.max(0, afterHideout - stashToQuest);

  return {
    stash,
    hideoutNeed,
    questSoftNeed,
    questFirNeed,
    stashToHideout,
    stashToQuest,
    hideoutToObtain: hideoutNeed - stashToHideout,
    questSoftToObtain: questSoftNeed - stashToQuest,
    surplus,
  };
}
