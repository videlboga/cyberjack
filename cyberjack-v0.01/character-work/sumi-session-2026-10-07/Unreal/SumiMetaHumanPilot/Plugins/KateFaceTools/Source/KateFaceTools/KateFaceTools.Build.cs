using UnrealBuildTool;
public class KateFaceTools : ModuleRules {
 public KateFaceTools(ReadOnlyTargetRules Target) : base(Target) {
  PCHUsage=PCHUsageMode.UseExplicitOrSharedPCHs;
  PublicDependencyModuleNames.AddRange(new string[]{"AssetRegistry","HairStrandsCore","Niagara","KateHairRuntime","CurveExpression","CurveExpressionEditor","RigLogicModule","RenderCore","RHI","Core","CoreUObject","Engine","MetaHumanCharacter","MetaHumanCharacterEditor","MetaHumanCoreTechLib","MetaHumanCharacterPalette","SkeletalMeshModifiers","MeshDescription","SkeletalMeshDescription","StaticMeshDescription","AnimGraph","AnimGraphRuntime","BlueprintGraph","Kismet","UnrealEd"});
 }
}
