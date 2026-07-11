<?php

declare(strict_types=1);

namespace App\Domain;

/**
 * Calcula el estado de una inscripción a partir del `config` JSON del
 * evaluation_scheme y de los resultados crudos cargados. Generaliza el
 * algoritmo original (fijo a 2 parciales) a N parciales, con requisitos de
 * TP/laboratorios configurables por ítem y reglas de promoción con
 * "high_count" parcial (caso Paradigmas: sólo K de N parciales necesitan la
 * nota alta, el resto alcanza con la nota de regularización).
 *
 * Espejo de assets/js/statusEngine.js — mantener ambos sincronizados.
 */
final class StatusCalculator
{
    public static function compute(array $config, array $partials, array $finals, array $checklist, ?string $override): string
    {
        if ($override) {
            return $override;
        }

        $partialCount = (int) ($config['partials'] ?? 2);
        $regularizationMinNote = (int) ($config['regularization']['min_note'] ?? 6);
        $approveMinNote = (int) ($config['approve']['min_note'] ?? 6);
        $promotion = $config['promotion'] ?? [];
        $highNote = (int) ($promotion['high_note'] ?? 8);
        $requiredHighCount = $promotion['high_count'] ?? $partialCount;
        $lowNote = $promotion['low_note'] ?? $regularizationMinNote;
        $maxRecovery = (int) ($promotion['max_recovery'] ?? 1);

        $states = [];
        $anyEntered = false;
        $hardFail = false;

        for ($p = 1; $p <= $partialCount; $p++) {
            $attempts = $partials[$p] ?? [];
            $a1 = $attempts[1] ?? null;
            $a2 = $attempts[2] ?? null;
            $a3 = $attempts[3] ?? null;

            $entered = $a1 !== null || $a2 !== null || $a3 !== null;
            if ($entered) {
                $anyEntered = true;
            }

            $effective = $a3 ?? $a2 ?? $a1;
            if ($a1 !== null && $a2 !== null && $a3 !== null && $effective < 6) {
                $hardFail = true;
            }

            $states[$p] = ['first' => $a1, 'second' => $a2, 'effective' => $effective];
        }

        // Esquemas "libre" (partials=0, solo final) no tienen parciales que
        // marquen actividad — sin esto, anyEntered nunca pasaría a true y
        // quedaría en "Faltan notas" para siempre, aunque ya haya un final cargado.
        if (!$anyEntered) {
            foreach ($finals as $final) {
                if (($final['grade'] ?? null) !== null) {
                    $anyEntered = true;
                    break;
                }
            }
        }

        if (!$anyEntered) {
            return 'Faltan notas';
        }

        $checklistOk = self::checklistGate($config, $checklist);

        // Sin parciales no hay nada que regularizar (no es "vacuously true": es
        // que la regularización, como la promoción, no existe en un esquema
        // "libre" — solo el final define el resultado).
        $allRegularizedByGrades = $partialCount > 0;
        foreach ($states as $state) {
            if ($state['effective'] === null || $state['effective'] < $regularizationMinNote) {
                $allRegularizedByGrades = false;
                break;
            }
        }

        $highSet = [];
        $recoveryCandidates = [];
        foreach ($states as $p => $state) {
            if ($state['first'] !== null && $state['first'] >= $highNote) {
                $highSet[$p] = true;
            } elseif ($state['second'] !== null && $state['second'] >= $highNote) {
                $recoveryCandidates[] = $p;
            }
        }
        $usedRecovery = min(count($recoveryCandidates), $maxRecovery);
        for ($i = 0; $i < $usedRecovery; $i++) {
            $highSet[$recoveryCandidates[$i]] = true;
        }
        $totalHigh = count($highSet);

        $remainingOk = true;
        foreach ($states as $p => $state) {
            if (isset($highSet[$p])) {
                continue;
            }
            if ($state['effective'] === null || $state['effective'] < $lowNote) {
                $remainingOk = false;
                break;
            }
        }

        // partialCount > 0: promocionar es "eximirse del final por buenos
        // parciales" — sin parciales (esquema "libre") no hay de qué eximirse.
        $promotionEligible = $partialCount > 0
            && !$hardFail
            && $totalHigh >= $requiredHighCount
            && $remainingOk
            && $checklistOk('promotion');

        if ($promotionEligible) {
            return 'Promocionada';
        }

        foreach ($finals as $final) {
            $grade = $final['grade'] ?? null;
            if ($grade !== null && $grade >= $approveMinNote) {
                return 'Aprobada';
            }
        }

        if ($hardFail) {
            return 'Desaprobada';
        }

        if ($allRegularizedByGrades && $checklistOk('regularization')) {
            return 'Regularizada';
        }

        return 'No regularizada';
    }

    private static function checklistGate(array $config, array $checklist): \Closure
    {
        return static function (string $requiredFor) use ($config, $checklist): bool {
            foreach ([['tp', 'tp_required_for'], ['lab', 'labs_required_for']] as [$type, $requiredForKey]) {
                $count = (int) ($config[$type === 'tp' ? 'tp' : 'labs'] ?? 0);
                $requiredForList = $config[$requiredForKey] ?? [];
                if ($count === 0 || !in_array($requiredFor, $requiredForList, true)) {
                    continue;
                }
                for ($i = 1; $i <= $count; $i++) {
                    if (empty($checklist[$type][$i])) {
                        return false;
                    }
                }
            }
            return true;
        };
    }
}
