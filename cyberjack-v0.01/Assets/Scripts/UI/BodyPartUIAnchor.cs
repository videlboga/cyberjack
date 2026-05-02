using UnityEngine;
using UnityEngine.Events;

namespace Cyberjack.UI
{
    /// <summary>
    /// Вешается на кость или меш персонажа. 
    /// Позволяет "привязать" UI к конкретной части тела.
    /// </summary>
    public class BodyPartUIAnchor : MonoBehaviour
    {
        [Header("Identity")]
        public string partId; // Например: "head", "chest", "arm_l"
        
        [Header("UI Mounting")]
        [Tooltip("Точка, где физически будет висеть панель. Если пусто, используется сам объект.")]
        public Transform mountPoint;

        [Header("Interaction")]
        public UnityEvent onClick;

        private void Start()
        {
            if (mountPoint == null) mountPoint = transform;
            
            // Если нет коллайдера, добавляем MeshCollider, чтобы клики работали
            if (GetComponent<Collider>() == null && GetComponent<MeshRenderer>() != null)
            {
                gameObject.AddComponent<MeshCollider>();
            }
        }

        private void OnMouseDown()
        {
            onClick?.Invoke();
        }
    }
}
