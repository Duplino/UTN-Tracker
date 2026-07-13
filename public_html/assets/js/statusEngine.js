// Calcula el estado de una inscripción a partir del `config` JSON del
// evaluation_scheme y de los resultados crudos cargados. Generaliza el
// algoritmo original (fijo a 2 parciales) a N parciales, con requisitos de
// TP/laboratorios configurables por ítem y reglas de promoción con
// "high_count" parcial (caso Paradigmas: sólo K de N parciales necesitan la
// nota alta, el resto alcanza con la nota de regularización).
//
// Espejo de src/Domain/StatusCalculator.php — mantener ambos sincronizados.

export function computeStatus(config, partials, finals, checklist, override) {
  if (override) {
    return override;
  }

  const partialCount = config.partials ?? 2;
  const regularizationMinNote = config.regularization?.min_note ?? 6;
  const approveMinNote = config.approve?.min_note ?? 6;
  const promotion = config.promotion ?? {};
  const highNote = promotion.high_note ?? 8;
  const requiredHighCount = promotion.high_count ?? partialCount;
  const lowNote = promotion.low_note ?? regularizationMinNote;
  const maxRecovery = promotion.max_recovery ?? 1;

  const states = {};
  let allPartialSlotsEntered = partialCount === 0;
  let hardFail = false;

  for (let p = 1; p <= partialCount; p++) {
    const attempts = partials[p] ?? {};
    const a1 = attempts[1] ?? null;
    const a2 = attempts[2] ?? null;
    const a3 = attempts[3] ?? null;

    const entered = a1 !== null || a2 !== null || a3 !== null;
    if (!entered) {
      allPartialSlotsEntered = false;
    }

    const effective = a3 ?? a2 ?? a1 ?? null;
    if (a1 !== null && a2 !== null && a3 !== null && effective < 6) {
      hardFail = true;
    }

    states[p] = { first: a1, second: a2, effective };
  }

  // Si hay parciales, todos tienen que tener al menos una nota cargada antes
  // de seguir con el resto de los chequeos.
  if (partialCount > 0 && !allPartialSlotsEntered) {
    return 'Faltan notas';
  }

  if (partialCount === 0) {
    for (const final of finals) {
      if (final.grade !== null && final.grade !== undefined) {
        allPartialSlotsEntered = true;
        break;
      }
    }
  }

  if (!allPartialSlotsEntered) {
    return 'Faltan notas';
  }

  const checklistOk = makeChecklistGate(config, checklist);

  // Sin parciales no hay nada que regularizar (no es "vacuously true": la
  // regularización, como la promoción, no existe en un esquema "libre" — solo
  // el final define el resultado).
  let allRegularizedByGrades = partialCount > 0;
  for (const p in states) {
    const state = states[p];
    if (state.effective === null || state.effective < regularizationMinNote) {
      allRegularizedByGrades = false;
      break;
    }
  }

  const highSet = new Set();
  const recoveryCandidates = [];
  for (const p in states) {
    const state = states[p];
    if (state.first !== null && state.first >= highNote) {
      highSet.add(p);
    } else if (state.second !== null && state.second >= highNote) {
      recoveryCandidates.push(p);
    }
  }
  const usedRecovery = Math.min(recoveryCandidates.length, maxRecovery);
  for (let i = 0; i < usedRecovery; i++) {
    highSet.add(recoveryCandidates[i]);
  }
  const totalHigh = highSet.size;

  let remainingOk = true;
  for (const p in states) {
    if (highSet.has(p)) {
      continue;
    }
    const state = states[p];
    if (state.effective === null || state.effective < lowNote) {
      remainingOk = false;
      break;
    }
  }

  // partialCount > 0: promocionar es "eximirse del final por buenos
  // parciales" — sin parciales (esquema "libre") no hay de qué eximirse.
  const promotionEligible =
    partialCount > 0 && !hardFail && totalHigh >= requiredHighCount && remainingOk && checklistOk('promotion');

  if (promotionEligible) {
    return 'Promocionada';
  }

  for (const final of finals) {
    if (final.grade !== null && final.grade !== undefined && final.grade >= approveMinNote) {
      return 'Aprobada';
    }
  }

  if (hardFail) {
    return 'Desaprobada';
  }

  if (allRegularizedByGrades && checklistOk('regularization')) {
    return 'Regularizada';
  }

  return 'No regularizada';
}

function makeChecklistGate(config, checklist) {
  return function checklistOk(requiredFor) {
    for (const [type, countKey, requiredForKey] of [
      ['tp', 'tp', 'tp_required_for'],
      ['lab', 'labs', 'labs_required_for'],
    ]) {
      const count = config[countKey] ?? 0;
      const requiredForList = config[requiredForKey] ?? [];
      if (count === 0 || !requiredForList.includes(requiredFor)) {
        continue;
      }
      for (let i = 1; i <= count; i++) {
        if (!checklist?.[type]?.[i]) {
          return false;
        }
      }
    }
    return true;
  };
}
