using System.Collections.Generic;
using IllusionUtility.GetUtility;
using UnityEngine;

public class ItemObject
{
	public class ChildInfo
	{
		public GameObject objChild;

		public GameObject objParent;

		public Transform oldParent;

		public int kindSetParent;
	}

	public class Item
	{
		public GameObject objItem;

		public Animator animItem;

		public List<ChildInfo> lstChild = new List<ChildInfo>();
	}

	public class ParentInfo
	{
		public int numToWhomParent;

		public string nameParent;

		public string nameSelf;

		public int kindSetParent;
	}

	public class ListItem
	{
		public string nameManifest;

		public string pathAssetObject;

		public string nameObject;

		public string pathAssetAnimator;

		public string nameAnimator;

		public List<ParentInfo> lstParent = new List<ParentInfo>();
	}

	private Dictionary<int, Item> dicItem = new Dictionary<int, Item>();

	private Dictionary<int, ListItem> dicInfo = new Dictionary<int, ListItem>();

	public bool LoadItem(string _file, GameObject _boneMale, ChaControl[] _females, GameObject _objMap, HashSet<string> _hashAsset)
	{
		ReleaseItem();
		if (!LoadList(_file))
		{
			return false;
		}
		foreach (KeyValuePair<int, ListItem> item2 in dicInfo)
		{
			string text = (AssetBundleCheck.IsSimulation ? "" : item2.Value.nameManifest);
			Item item = new Item
			{
				objItem = CommonLib.LoadAsset<GameObject>(item2.Value.pathAssetObject, item2.Value.nameObject, clone: true, text)
			};
			AssetBundleManager.UnloadAssetBundle(item2.Value.pathAssetObject, isUnloadForceRefCount: false, text);
			LoadAnimation(item, item2.Value);
			dicItem.Add(item2.Key, item);
		}
		foreach (KeyValuePair<int, ListItem> item3 in dicInfo)
		{
			if (!dicItem.ContainsKey(item3.Key))
			{
				break;
			}
			if (dicItem[item3.Key].objItem == null)
			{
				continue;
			}
			foreach (ParentInfo item4 in item3.Value.lstParent)
			{
				GameObject gameObject = null;
				if (item4.numToWhomParent == 0)
				{
					if ((bool)_boneMale)
					{
						gameObject = _boneMale.transform.FindLoop(item4.nameParent);
					}
				}
				else if (item4.numToWhomParent == 1)
				{
					if ((bool)_females[0] && (bool)_females[0].objBodyBone)
					{
						gameObject = _females[0].objBodyBone.transform.FindLoop(item4.nameParent);
					}
				}
				else if (item4.numToWhomParent == 2)
				{
					if ((bool)_objMap)
					{
						gameObject = _objMap.transform.FindLoop(item4.nameParent);
					}
				}
				else if (item4.numToWhomParent == 11)
				{
					if ((bool)_females[1] && (bool)_females[1].objBodyBone)
					{
						gameObject = _females[1].objBodyBone.transform.FindLoop(item4.nameParent);
					}
				}
				else
				{
					int key = item4.numToWhomParent - 100;
					if (dicItem.ContainsKey(key) && (bool)dicItem[key].objItem)
					{
						gameObject = dicItem[key].objItem.transform.FindLoop(item4.nameParent);
					}
				}
				GameObject gameObject2 = null;
				gameObject2 = ((!(item4.nameSelf != "")) ? dicItem[item3.Key].objItem : dicItem[item3.Key].objItem.transform.FindLoop(item4.nameSelf));
				if (!(gameObject == null) && !(gameObject2 == null))
				{
					ChildInfo childInfo = new ChildInfo();
					childInfo.objChild = gameObject2;
					childInfo.oldParent = gameObject2.transform.parent;
					childInfo.objParent = gameObject;
					childInfo.kindSetParent = item4.kindSetParent;
					dicItem[item3.Key].lstChild.Add(childInfo);
					if (item4.kindSetParent == 0)
					{
						gameObject2.transform.SetParent(gameObject.transform, worldPositionStays: false);
					}
				}
			}
		}
		return true;
	}

	public bool ReleaseItem()
	{
		foreach (KeyValuePair<int, Item> item in dicItem)
		{
			if (item.Value.objItem == null)
			{
				continue;
			}
			for (int i = 0; i < item.Value.lstChild.Count; i++)
			{
				ChildInfo childInfo = item.Value.lstChild[i];
				if ((bool)childInfo.objChild && (bool)childInfo.oldParent)
				{
					childInfo.objChild.transform.SetParent(childInfo.oldParent);
				}
			}
			item.Value.objItem.transform.SetParent(null);
			Object.Destroy(item.Value.objItem);
			item.Value.objItem = null;
			item.Value.animItem = null;
		}
		dicItem.Clear();
		return true;
	}

	public bool LateUpdate()
	{
		foreach (KeyValuePair<int, Item> item in dicItem)
		{
			if (item.Value.objItem == null)
			{
				continue;
			}
			for (int i = 0; i < item.Value.lstChild.Count; i++)
			{
				ChildInfo childInfo = item.Value.lstChild[i];
				if (childInfo.kindSetParent != 0 && (bool)childInfo.objChild && (bool)childInfo.objParent)
				{
					childInfo.objChild.transform.position = childInfo.objParent.transform.position;
					childInfo.objChild.transform.rotation = childInfo.objParent.transform.rotation;
				}
			}
		}
		return true;
	}

	public bool SetTransform(Transform _transform)
	{
		if (_transform == null)
		{
			return false;
		}
		foreach (KeyValuePair<int, Item> item in dicItem)
		{
			if (!(item.Value.objItem == null) && !(item.Value.objItem.transform.parent != null))
			{
				item.Value.objItem.transform.position = _transform.position;
				item.Value.objItem.transform.rotation = _transform.rotation;
			}
		}
		return true;
	}

	public bool SetTransform(Vector3 _pos, Vector3 _rot)
	{
		foreach (KeyValuePair<int, Item> item in dicItem)
		{
			if (!(item.Value.objItem == null) && !(item.Value.objItem.transform.parent != null))
			{
				item.Value.objItem.transform.position = _pos;
				item.Value.objItem.transform.rotation = Quaternion.Euler(_rot);
			}
		}
		return true;
	}

	public void SetPlay(string _strAnmName)
	{
		foreach (KeyValuePair<int, Item> item in dicItem)
		{
			if (!(item.Value.animItem == null))
			{
				item.Value.animItem.Play(_strAnmName, 0);
			}
		}
	}

	public void SetPlay(string _strAnmName, float normalizeTime)
	{
		foreach (KeyValuePair<int, Item> item in dicItem)
		{
			if (!(item.Value.animItem == null))
			{
				item.Value.animItem.Play(_strAnmName, 0, normalizeTime);
			}
		}
	}

	public bool SetPlay(string _strAnmName, int _nObjID)
	{
		if (!dicItem.ContainsKey(_nObjID))
		{
			return false;
		}
		if (dicItem[_nObjID].animItem == null)
		{
			return false;
		}
		dicItem[_nObjID].animItem.Play(_strAnmName, 0);
		return true;
	}

	public void SyncPlay(int _nameHash, float _fnormalizedTime)
	{
		foreach (KeyValuePair<int, Item> item in dicItem)
		{
			if (!(item.Value.animItem == null))
			{
				item.Value.animItem.Play(_nameHash, 0, _fnormalizedTime);
			}
		}
	}

	public void SetAnimatorParamTrigger(string _strAnmName)
	{
		foreach (KeyValuePair<int, Item> item in dicItem)
		{
			if (!(item.Value.animItem == null))
			{
				item.Value.animItem.SetTrigger(_strAnmName);
			}
		}
	}

	public void SetAnimatorParamResetTrigger(string _strAnmName)
	{
		foreach (KeyValuePair<int, Item> item in dicItem)
		{
			if (!(item.Value.animItem == null))
			{
				item.Value.animItem.ResetTrigger(_strAnmName);
			}
		}
	}

	public void SetAnimatorParamBool(string _strAnmName, bool _bFlag)
	{
		foreach (KeyValuePair<int, Item> item in dicItem)
		{
			if (!(item.Value.animItem == null))
			{
				item.Value.animItem.SetBool(_strAnmName, _bFlag);
			}
		}
	}

	public void SetAnimatorParamFloat(string _strAnmName, float _fValue)
	{
		foreach (KeyValuePair<int, Item> item in dicItem)
		{
			if (!(item.Value.animItem == null))
			{
				item.Value.animItem.SetFloat(_strAnmName, _fValue);
			}
		}
	}

	public void SetAnimatorParamFloat(int _paramID, float _fValue)
	{
		foreach (KeyValuePair<int, Item> item in dicItem)
		{
			if (!(item.Value.animItem == null))
			{
				item.Value.animItem.SetFloat(_paramID, _fValue);
			}
		}
	}

	public void SetAnimationSpeed(float _speed)
	{
		foreach (KeyValuePair<int, Item> item in dicItem)
		{
			if (!(item.Value.animItem == null))
			{
				item.Value.animItem.speed = _speed;
			}
		}
	}

	public GameObject GetItem(int _ID)
	{
		if (!dicItem.ContainsKey(_ID))
		{
			return null;
		}
		return dicItem[_ID].objItem;
	}

	public Dictionary<int, Item> GetItems()
	{
		return dicItem;
	}

	public bool SetVisible(bool _visible)
	{
		foreach (KeyValuePair<int, Item> item in dicItem)
		{
			if (!(item.Value.objItem == null))
			{
				item.Value.objItem.SetActive(_visible);
			}
		}
		return true;
	}

	public bool SetUpdate()
	{
		foreach (KeyValuePair<int, Item> item in dicItem)
		{
			if (!(item.Value.animItem == null))
			{
				item.Value.animItem.Update(0f);
			}
		}
		return true;
	}

	public bool LoadList(string _file)
	{
		if (_file == "")
		{
			return false;
		}
		dicInfo.Clear();
		foreach (string item in HFlag.lstABName)
		{
			if (!AssetBundleCheck.IsFile(item, _file) || (!AssetBundleCheck.IsSimulation && !HFlag.BundleCheck(item, _file)))
			{
				continue;
			}
			HitemObjectData hitemObjectData = CommonLib.LoadAsset<HitemObjectData>(item, _file, clone: false, "", check: false);
			AssetBundleManager.UnloadAssetBundle(item, isUnloadForceRefCount: true);
			if (hitemObjectData == null)
			{
				continue;
			}
			foreach (HitemObjectData.Param item2 in hitemObjectData.param)
			{
				if (!dicInfo.ContainsKey(item2.id))
				{
					dicInfo.Add(item2.id, new ListItem());
				}
				ListItem listItem = dicInfo[item2.id];
				listItem.nameManifest = item2.manifest;
				listItem.pathAssetObject = item2.pathAssetObject;
				listItem.nameObject = item2.nameObject;
				listItem.pathAssetAnimator = item2.pathAssetAnimator;
				listItem.nameAnimator = item2.nameAnimator;
				foreach (HitemObjectData.ParentInfo item3 in item2.lstParent)
				{
					listItem.lstParent.Add(new ParentInfo
					{
						numToWhomParent = item3.numToWhomParent,
						nameParent = item3.nameParent,
						nameSelf = item3.nameSelf,
						kindSetParent = item3.kindSetParent
					});
				}
			}
		}
		return true;
	}

	private bool LoadAnimation(Item _item, ListItem _info)
	{
		if (_item.objItem == null)
		{
			return false;
		}
		_item.animItem = _item.objItem.GetComponent<Animator>();
		if (_item.animItem == null)
		{
			_item.animItem = _item.objItem.GetComponentInChildren<Animator>();
			if (_item.animItem == null)
			{
				return false;
			}
		}
		if (_info.pathAssetAnimator.IsNullOrEmpty() || _info.nameAnimator.IsNullOrEmpty())
		{
			_item.animItem = null;
			return false;
		}
		_item.animItem.runtimeAnimatorController = CommonLib.LoadAsset<RuntimeAnimatorController>(_info.pathAssetAnimator, _info.nameAnimator);
		if (_item.animItem.runtimeAnimatorController == null)
		{
			_item.animItem = null;
		}
		return true;
	}
}
