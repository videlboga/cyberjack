using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Text;
using Sirenix.OdinInspector;

public class FaceListCtrl : SerializedMonoBehaviour
{
	[Serializable]
	public class FaceInfo
	{
		public int id;

		public string name = "";

		public int eyebrow;

		public int eye;

		public float openMaxEye = 1f;

		public int mouth;

		public float openMinMouth;

		public int tears;

		public float cheek;

		public bool highlight = true;

		public bool eyesblink = true;

		public bool yure;

		public FaceInfo()
		{
			MemberInit();
		}

		public FaceInfo(FaceInfo _copy)
		{
			id = _copy.id;
			name = _copy.name;
			eyebrow = _copy.eyebrow;
			eye = _copy.eye;
			openMaxEye = _copy.openMaxEye;
			mouth = _copy.mouth;
			openMinMouth = _copy.openMinMouth;
			tears = _copy.tears;
			cheek = _copy.cheek;
			highlight = _copy.highlight;
			eyesblink = _copy.eyesblink;
			yure = _copy.yure;
		}

		public void Copy(FaceInfo _copy)
		{
			id = _copy.id;
			name = _copy.name;
			eyebrow = _copy.eyebrow;
			eye = _copy.eye;
			openMaxEye = _copy.openMaxEye;
			mouth = _copy.mouth;
			openMinMouth = _copy.openMinMouth;
			tears = _copy.tears;
			cheek = _copy.cheek;
			highlight = _copy.highlight;
			eyesblink = _copy.eyesblink;
			yure = _copy.yure;
		}

		public void MemberInit()
		{
			id = 0;
			name = "";
			eyebrow = 0;
			eye = 0;
			openMaxEye = 1f;
			mouth = 0;
			openMinMouth = 0f;
			tears = 0;
			cheek = 0f;
			highlight = true;
			eyesblink = true;
			yure = false;
		}
	}

	public List<List<Dictionary<int, FaceInfo>>> facelib = new List<List<Dictionary<int, FaceInfo>>>();

	private GlobalMethod.FloatBlend blendEye = new GlobalMethod.FloatBlend();

	private GlobalMethod.FloatBlend blendMouth = new GlobalMethod.FloatBlend();

	private StringBuilder sb = new StringBuilder();

	private readonly Dictionary<string, string> fixPersonal = new Dictionary<string, string> { { "c-13", "c39" } };

	private void Start()
	{
		for (int i = 0; i < 3; i++)
		{
			facelib.Add(new List<Dictionary<int, FaceInfo>>());
		}
		for (int j = 0; j < 8; j++)
		{
			facelib[0].Add(new Dictionary<int, FaceInfo>());
		}
		for (int k = 0; k < 9; k++)
		{
			facelib[1].Add(new Dictionary<int, FaceInfo>());
		}
		facelib[2].Add(new Dictionary<int, FaceInfo>());
	}

	public bool Release()
	{
		for (int i = 0; i < facelib[0].Count; i++)
		{
			facelib[0][i].Clear();
		}
		for (int j = 0; j < facelib[1].Count; j++)
		{
			facelib[1][j].Clear();
		}
		facelib[2][0].Clear();
		return true;
	}

	public IEnumerator LoadText(string _chaNo)
	{
		Release();
		string chaNo = _chaNo;
		if (fixPersonal.ContainsKey(_chaNo))
		{
			chaNo = fixPersonal[_chaNo];
		}
		for (int i = 0; i < 8; i++)
		{
			LoadInfo(chaNo, 0, i, facelib[0][i]);
		}
		yield return null;
		for (int j = 0; j < 9; j++)
		{
			LoadInfo(chaNo, 1, j, facelib[1][j]);
		}
		LoadInfo(chaNo, 2, 0, facelib[2][0]);
		yield return null;
	}

	public bool LoadTextD(string _chaNo)
	{
		Release();
		for (int i = 0; i < 8; i++)
		{
			LoadInfo(_chaNo, 0, i, facelib[0][i]);
		}
		for (int j = 0; j < 9; j++)
		{
			LoadInfo(_chaNo, 1, j, facelib[1][j]);
		}
		LoadInfo(_chaNo, 2, 0, facelib[2][0]);
		return true;
	}

	public bool LoadInfo(string _chaNo, int _voiceKind, int _action, Dictionary<int, FaceInfo> _dic)
	{
		sb.Clear();
		sb.AppendFormat("HFaceList_{0}_{1:00}_{2:00}", _chaNo, _voiceKind, _action);
		foreach (string item in HFlag.lstABName)
		{
			if (!AssetBundleCheck.IsFile(item, sb.ToString()) || (!AssetBundleCheck.IsSimulation && !HFlag.BundleCheck(item, sb.ToString())))
			{
				continue;
			}
			HFaceData hFaceData = CommonLib.LoadAsset<HFaceData>(item, sb.ToString(), clone: false, "", check: false);
			AssetBundleManager.UnloadAssetBundle(item, isUnloadForceRefCount: true);
			if (hFaceData == null)
			{
				continue;
			}
			foreach (HFaceData.Param item2 in hFaceData.param)
			{
				int id = item2.id;
				if (!_dic.ContainsKey(id))
				{
					_dic.Add(id, new FaceInfo());
				}
				FaceInfo faceInfo = _dic[id];
				faceInfo.id = id;
				faceInfo.name = item2.name;
				faceInfo.eyebrow = item2.eyebrow;
				faceInfo.eye = item2.eye;
				faceInfo.openMaxEye = item2.openMaxEye;
				faceInfo.mouth = item2.mouth;
				faceInfo.openMinMouth = item2.openMinMouth;
				faceInfo.tears = item2.tears;
				faceInfo.cheek = item2.cheek;
				faceInfo.highlight = item2.highlight;
				faceInfo.eyesblink = item2.eyesblink;
				faceInfo.yure = item2.yure;
			}
		}
		return true;
	}

	public bool SetFace(int _idFace, ChaControl _chara, int _voiceKind, int _action)
	{
		if (_chara == null)
		{
			return false;
		}
		if (facelib.Count <= _voiceKind || _voiceKind < 0)
		{
			return false;
		}
		if (facelib[_voiceKind].Count <= _action || _action < 0)
		{
			return false;
		}
		if (!facelib[_voiceKind][_action].ContainsKey(_idFace))
		{
			return false;
		}
		FaceInfo info = facelib[_voiceKind][_action][_idFace];
		_chara.ChangeEyebrowPtn(info.eyebrow);
		_chara.ChangeEyesPtn(info.eye);
		_chara.eyesCtrl.SafeProc(delegate(FBSCtrlEyes e)
		{
			blendEye.Start(e.OpenMax, info.openMaxEye, 0.3f);
		});
		_chara.ChangeMouthPtn(info.mouth);
		_chara.mouthCtrl.SafeProc(delegate(FBSCtrlMouth m)
		{
			blendMouth.Start(m.OpenMin, info.openMinMouth, 0.3f);
		});
		_chara.tearsLv = (byte)info.tears;
		_chara.ChangeHohoAkaRate(info.cheek);
		_chara.HideEyeHighlight(!info.highlight);
		_chara.ChangeEyesBlinkFlag(info.eyesblink);
		_chara.ChangeEyesShaking(info.yure);
		_chara.DisableShapeMouth(MathfEx.IsRange(21, info.mouth, 22, isEqual: true));
		return true;
	}

	public bool OpenCtrl(ChaControl _female)
	{
		if (!_female)
		{
			return false;
		}
		float _ans = 0f;
		if (blendEye.Proc(ref _ans))
		{
			_female.ChangeEyesOpenMax(_ans);
		}
		_female.mouthCtrl.SafeProc(delegate(FBSCtrlMouth m)
		{
			float _ans2 = 0f;
			if (blendMouth.Proc(ref _ans2))
			{
				m.OpenMin = _ans2;
			}
		});
		return true;
	}

	private void SaveText(StreamWriter _writer, int _voiceKind, int _action)
	{
		foreach (KeyValuePair<int, FaceInfo> item in facelib[_voiceKind][_action])
		{
			_writer.Write(item.Value.id + "\t");
			_writer.Write(item.Value.name + "\t");
			_writer.Write(item.Value.eyebrow + "\t");
			_writer.Write(item.Value.eye + "\t");
			_writer.Write(item.Value.openMaxEye + "\t");
			_writer.Write(item.Value.mouth + "\t");
			_writer.Write(item.Value.openMinMouth + "\t");
			_writer.Write(item.Value.tears + "\t");
			_writer.Write(item.Value.cheek + "\t");
			_writer.Write(item.Value.highlight ? "1" : "0\t");
			_writer.Write(item.Value.eyesblink ? "1" : "0\t");
			_writer.Write(item.Value.yure ? "1" : "0\t");
			_writer.Write("\n");
		}
	}

	private void SaveFaceData(int _voiceKind, int _action, ref HFaceData data)
	{
		data.param.Clear();
		foreach (KeyValuePair<int, FaceInfo> item in facelib[_voiceKind][_action])
		{
			HFaceData.Param param = new HFaceData.Param();
			param.id = item.Value.id;
			param.name = item.Value.name;
			param.eyebrow = item.Value.eyebrow;
			param.eye = item.Value.eye;
			param.openMaxEye = item.Value.openMaxEye;
			param.mouth = item.Value.mouth;
			param.openMinMouth = item.Value.openMinMouth;
			param.tears = item.Value.tears;
			param.cheek = item.Value.cheek;
			param.highlight = item.Value.highlight;
			param.eyesblink = item.Value.eyesblink;
			param.yure = item.Value.yure;
			data.param.Add(param);
		}
	}
}
