import json

paths = [
    "/home/cyberkitty/My project (5)/Packages/manifest.json",
    "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/Packages/manifest.json"
]

for path in paths:
    try:
        with open(path, 'r') as f:
            data = json.load(f)
        
        # Remove local file dependencies
        deps_to_remove = [k for k in data.get('dependencies', {}) if k.startswith('org.nuget.voltrpc') or k.startswith('dev.voltstro')]
        for k in deps_to_remove:
            del data['dependencies'][k]
            
        # Add new packages (version 2.2.8 is the latest per GitHub info, voltRPC etc will be resolved)
        data['dependencies']['dev.voltstro.unitywebbrowser'] = '2.2.8'
        data['dependencies']['dev.voltstro.unitywebbrowser.engine.cef'] = '2.2.8'
        data['dependencies']['dev.voltstro.unitywebbrowser.engine.cef.linux.x64'] = '2.2.8'
        
        # Add scoped registry
        if 'scopedRegistries' not in data:
            data['scopedRegistries'] = []
            
        # check if it already exists
        has_voltupr = False
        for reg in data['scopedRegistries']:
            if reg.get('name') == 'VoltUPR':
                has_voltupr = True
                break
                
        if not has_voltupr:
            data['scopedRegistries'].append({
                "name": "VoltUPR",
                "url": "https://upr.voltstro.dev",
                "scopes": [
                    "dev.voltstro",
                    "org.nuget",
                    "com.cysharp.unitask"
                ]
            })
            
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)
            
        print(f"Updated {path}")
    except Exception as e:
        print(f"Error updating {path}: {e}")

