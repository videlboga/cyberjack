#pragma once
#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "KateHairDynamics.generated.h"
UCLASS(Transient, Blueprintable)
class KATEHAIRRUNTIME_API UKateHairDynamics : public UAnimInstance {
 GENERATED_BODY()
protected:
 virtual FAnimInstanceProxy* CreateAnimInstanceProxy() override;
 virtual void DestroyAnimInstanceProxy(FAnimInstanceProxy* Proxy) override;
};
