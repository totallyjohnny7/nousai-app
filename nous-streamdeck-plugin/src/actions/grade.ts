/**
 * Grade Actions — Send card grades to Nous.
 * UUIDs: com.nousai.grade.{again,hard,good,easy}
 */

import { nousClient } from '../nous-client';

export function handleGradeAgain(): void {
  nousClient.sendAction('GRADE_AGAIN');
}

export function handleGradeHard(): void {
  nousClient.sendAction('GRADE_HARD');
}

export function handleGradeGood(): void {
  nousClient.sendAction('GRADE_GOOD');
}

export function handleGradeEasy(): void {
  nousClient.sendAction('GRADE_EASY');
}
