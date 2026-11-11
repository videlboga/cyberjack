#pragma once
#include "CoreMinimal.h"
#include "Components/SkeletalMeshComponent.h"
#include "KateBodySurfaceComponent.generated.h"
UCLASS(ClassGroup=(Kate),meta=(BlueprintSpawnableComponent))
class KATEFACETOOLS_API UKateBodySurfaceComponent : public USkeletalMeshComponent {
 GENERATED_BODY()
 protected: virtual void OnRegister() override;
};
