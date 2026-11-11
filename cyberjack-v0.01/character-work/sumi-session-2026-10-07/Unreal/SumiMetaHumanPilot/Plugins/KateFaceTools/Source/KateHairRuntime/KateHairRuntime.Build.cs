using UnrealBuildTool;
public class KateHairRuntime : ModuleRules {
 public KateHairRuntime(ReadOnlyTargetRules Target) : base(Target) {
 PCHUsage=PCHUsageMode.UseExplicitOrSharedPCHs;
 PublicDependencyModuleNames.AddRange(new string[]{"Core","CoreUObject","Engine"});
 }
}
