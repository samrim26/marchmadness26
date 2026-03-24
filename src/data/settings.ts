import type { ScoringSettings } from "@/lib/types";

/**
 * Points awarded for correctly predicting the winner of each round.
 * Earlier rounds (first_round, second_round) are included for completeness
 * but are not actively used since this app starts at the Sweet 16.
 */
export const SCORING_SETTINGS: ScoringSettings = {
  first_round: 1,
  second_round: 2,
  sweet16: 4,
  elite8: 8,
  final4: 16,
  championship: 32,
};
