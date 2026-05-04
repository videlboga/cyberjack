using UnityEngine;
using VoltstroStudios.UnityWebBrowser;

namespace Cyberjack.UI
{
    public class InteractionManager : MonoBehaviour
    {
        [Header("References")]
        public WebBrowserUI webBrowser;
        public Camera mainCamera;

        [Header("Settings")]
        public LayerMask interactableLayer; 
        public float interactDistance = 5f;

        [Header("Dialogue Hooks")]
        public string characterActorId = "S-AV-01";
        public Transform headAnchor;

        private BodyPartUIAnchor currentHoveredPart;

        private void Update()
        {
            UpdateSpeechBubbles();

            // 1. Пускаем луч из центра экрана или от курсора
            // (Зависит от того, как настроен FirstPersonController. Допустим, от курсора мыши)
            Ray ray = mainCamera.ScreenPointToRay(Input.mousePosition);
            
            if (Physics.Raycast(ray, out RaycastHit hit, interactDistance, interactableLayer))
            {
                var part = hit.collider.GetComponent<BodyPartUIAnchor>();
                
                if (part != null)
                {
                    if (currentHoveredPart != part)
                    {
                        currentHoveredPart = part;
                    }

                    // 2. Переводим 3D координату объекта в 2D пиксели на экране
                    Vector3 screenPos = mainCamera.WorldToScreenPoint(part.mountPoint != null ? part.mountPoint.position : part.transform.position);

                    // Важно: в Unity Y идет снизу-вверх, а в HTML/CSS сверху-вниз. Инвертируем Y.
                    float screenY = Screen.height - screenPos.y;

                    // 3. Отправляем в веб через JS
                    if (webBrowser != null && webBrowser.browserClient.IsConnected)
                    {
                        string js = $"if(window.CyberjackUI) window.CyberjackUI.showHoverInfo('{part.partId}', 'SYS_01', {screenPos.x}, {screenY});";
                        webBrowser.browserClient.ExecuteJs(js);
                    }
                }
            }
            else
            {
                if (currentHoveredPart != null)
                {
                    currentHoveredPart = null;
                    if (webBrowser != null && webBrowser.browserClient.IsConnected)
                    {
                        webBrowser.browserClient.ExecuteJs("if(window.CyberjackUI) window.CyberjackUI.hideHoverInfo();");
                    }
                }
            }

            // 4. Обработка Клика (для Радиального меню)
            if (Input.GetMouseButtonDown(0) && currentHoveredPart != null)
            {
                // Посылаем координаты клика мыши (тоже с инверсией Y)
                float mouseX = Input.mousePosition.x;
                float mouseY = Screen.height - Input.mousePosition.y;

                if (webBrowser != null && webBrowser.browserClient.IsConnected)
                {
                    string js = $"if(window.CyberjackUI) window.CyberjackUI.showRadialMenu({mouseX}, {mouseY});";
                    webBrowser.browserClient.ExecuteJs(js);
                }
            }
        }

        private void UpdateSpeechBubbles()
        {
            // Поиск якоря "face" среди всех BodyPartUIAnchor
            if (webBrowser != null && webBrowser.browserClient.IsConnected)
            {
                BodyPartUIAnchor faceAnchor = null;
                var anchors = FindObjectsOfType<BodyPartUIAnchor>();
                foreach (var anchor in anchors)
                {
                    if (anchor.partId == "face")
                    {
                        faceAnchor = anchor;
                        break;
                    }
                }

                Transform targetTransform = faceAnchor != null ? (faceAnchor.mountPoint != null ? faceAnchor.mountPoint : faceAnchor.transform) : headAnchor;

                if (targetTransform != null)
                {
                    Vector3 screenPos = mainCamera.WorldToScreenPoint(targetTransform.position);
                    
                    // If behind camera, don't show or send off-screen coords
                    if (screenPos.z < 0) return;

                    float normX = screenPos.x / Screen.width;
                    float normY = (Screen.height - screenPos.y) / Screen.height;

                    string js = $"if(window.CyberjackUI) window.CyberjackUI.updateSpeechBubblePosition('{characterActorId}', {normX.ToString("F3", System.Globalization.CultureInfo.InvariantCulture)}, {normY.ToString("F3", System.Globalization.CultureInfo.InvariantCulture)});";
                    webBrowser.browserClient.ExecuteJs(js);
                }
            }
        }
    }
}