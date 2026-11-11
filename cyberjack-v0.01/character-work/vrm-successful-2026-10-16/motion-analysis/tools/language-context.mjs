// The interpreter needs semantic profile fields, not renderer calibration.
// Geometric planning still receives the complete, untouched request state.
export function languageContext(current){const {physicsColliders,anatomicalLandmarks,...profile}=current.profile||{};return {...current,profile};}
