// Maps profiles.onboarding_step to the route the user should resume at.
// 0 = needs family, 1 = needs first patient, 2 = needs emergency data,
// >=3 = done, send to dashboard.
export function onboardingRouteForStep(step: number | null | undefined): string {
  const s = step ?? 0;
  if (s <= 0) return "/onboarding/familia";
  if (s === 1) return "/onboarding/familiar";
  if (s === 2) return "/onboarding/emergencia";
  return "/dashboard";
}
