using UnityEngine;
using VoltstroStudios.UnityWebBrowser; // Убедитесь, что пространство имен совпадает с версией UWB

namespace Cyberjack.UI
{
    public class BodyUIManager : MonoBehaviour
    {
        public static BodyUIManager Instance;

        [Header("Web Browser Panels")]
        public WebBrowserUI infoPanelBrowser;
        public WebBrowserUI radialMenuBrowser;

        private BodyPartUIAnchor currentAnchor;

        private void Awake()
        {
            Instance = this;
            if (infoPanelBrowser) infoPanelBrowser.gameObject.SetActive(false);
            if (radialMenuBrowser) radialMenuBrowser.gameObject.SetActive(false);
        }

        public void ShowUI(BodyPartUIAnchor anchor)
        {
            currentAnchor = anchor;
            
            if (infoPanelBrowser)
            {
                infoPanelBrowser.gameObject.SetActive(true);
                // Позиционируем
                infoPanelBrowser.transform.position = anchor.mountPoint.position;
                
                // Передаем данные в JS (Vite)
                string jsCommand = $"window.setBodyPart('{anchor.partId}')";
                // infoPanelBrowser.browserClient.ExecuteJs(jsCommand); 
                // Примечание: точный метод зависит от версии UWB, обычно это .ExecuteJs()
            }
            
            Debug.Log($"Displaying Web UI for {anchor.partId}");
        }

        private void Update()
        {
            if (currentAnchor != null)
            {
                Transform targetTransform = null;
                if (infoPanelBrowser && infoPanelBrowser.gameObject.activeSelf) 
                    targetTransform = infoPanelBrowser.transform;
                
                if (targetTransform != null)
                {
                    targetTransform.position = Vector3.Lerp(targetTransform.position, currentAnchor.mountPoint.position, Time.deltaTime * 5f);
                    targetTransform.LookAt(Camera.main.transform);
                    targetTransform.Rotate(0, 180, 0);
                }
            }
        }
    }
}
