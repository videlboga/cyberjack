using System.Collections.Generic;
using System.IO;
using System.Linq;
using Illusion;
using Illusion.Component.Correct;
using Illusion.Extensions;
using UnityEngine;

public class MotionIKData
{
	public class State
	{
		public string name = "";

		public Parts leftHand = new Parts();

		public Parts rightHand = new Parts();

		public Parts leftFoot = new Parts();

		public Parts rightFoot = new Parts();

		public Frame[] frames;

		public Parts this[int index] => parts[index];

		public Parts[] parts => new Parts[4] { leftHand, rightHand, leftFoot, rightFoot };
	}

	public class Parts
	{
		public Param2 param2 = new Param2();

		public Param3 param3 = new Param3();
	}

	public class Param2
	{
		public int sex;

		public string target = "";

		public float weightPos;

		public float weightAng;

		public static int Length => Utils.Type.GetPublicFields(typeof(Param2)).Length;

		public object this[int index]
		{
			get
			{
				return index switch
				{
					0 => sex, 
					1 => target, 
					2 => weightPos, 
					3 => weightAng, 
					_ => null, 
				};
			}
			set
			{
				switch (index)
				{
				case 0:
					sex = ((value is string) ? int.Parse((string)value) : ((int)value));
					break;
				case 1:
					target = (string)value;
					break;
				case 2:
					weightPos = ((value is string) ? float.Parse((string)value) : ((float)value));
					break;
				case 3:
					weightAng = ((value is string) ? float.Parse((string)value) : ((float)value));
					break;
				}
			}
		}
	}

	public class Param3
	{
		public string chein = "";

		public float weight;

		public static int Length => Utils.Type.GetPublicFields(typeof(Param3)).Length;

		public object this[int index]
		{
			get
			{
				return index switch
				{
					0 => chein, 
					1 => weight, 
					_ => null, 
				};
			}
			set
			{
				switch (index)
				{
				case 0:
					chein = (string)value;
					break;
				case 1:
					weight = ((value is string) ? float.Parse((string)value) : ((float)value));
					break;
				}
			}
		}
	}

	public class Frame
	{
		public int frameNo = -1;

		public int editNo;

		public Shape[] shapes;
	}

	public class Shape
	{
		public int shapeNo = -1;

		public PosAng small;

		public PosAng large;

		public PosAng this[int index]
		{
			get
			{
				return index switch
				{
					0 => small, 
					1 => large, 
					_ => null, 
				};
			}
			set
			{
				switch (index)
				{
				case 0:
					small = value;
					break;
				case 1:
					large = value;
					break;
				}
			}
		}
	}

	public class PosAng
	{
		public Vector3 pos;

		public Vector3 ang;

		public Vector3 this[int index]
		{
			get
			{
				return index switch
				{
					0 => pos, 
					1 => ang, 
					_ => Vector3.zero, 
				};
			}
			set
			{
				switch (index)
				{
				case 0:
					pos = value;
					break;
				case 1:
					ang = value;
					break;
				}
			}
		}

		public float[] posArray => new float[3] { pos.x, pos.y, pos.z };

		public float[] angArray => new float[3] { ang.x, ang.y, ang.z };
	}

	private State[] _states;

	public State[] states
	{
		get
		{
			return _states;
		}
		set
		{
			_states = value;
		}
	}

	public MotionIKData()
	{
	}

	public MotionIKData(TextAsset ta)
	{
		Read(ta);
	}

	public MotionIKData(string path)
	{
		Read(path);
	}

	public MotionIKData Copy()
	{
		MotionIKData motionIKData = new MotionIKData();
		int num = states.Length;
		motionIKData.states = new State[num];
		for (int i = 0; i < num; i++)
		{
			State state = new State();
			State state2 = states[i];
			state.name = state2.name;
			int num2 = state.parts.Length;
			for (int j = 0; j < num2; j++)
			{
				Parts obj = state.parts[j];
				Parts parts = state2.parts[j];
				obj.param2.sex = parts.param2.sex;
				obj.param2.target = parts.param2.target;
				obj.param2.weightPos = parts.param2.weightPos;
				obj.param2.weightAng = parts.param2.weightAng;
				obj.param3.chein = parts.param3.chein;
				obj.param3.weight = parts.param3.weight;
			}
			int num3 = state2.frames.Length;
			state.frames = new Frame[num3];
			for (int k = 0; k < num3; k++)
			{
				Frame frame = new Frame();
				Frame frame2 = state2.frames[k];
				frame.frameNo = frame2.frameNo;
				frame.editNo = frame2.editNo;
				int num4 = frame2.shapes.Length;
				frame.shapes = new Shape[num4];
				for (int l = 0; l < num4; l++)
				{
					Shape shape = new Shape();
					Shape shape2 = frame2.shapes[l];
					shape.shapeNo = shape2.shapeNo;
					for (int m = 0; m < 2; m++)
					{
						shape[m] = new PosAng();
						for (int n = 0; n < 3; n++)
						{
							shape[m].pos[n] = shape2[m].pos[n];
						}
						for (int num5 = 0; num5 < 3; num5++)
						{
							shape[m].ang[num5] = shape2[m].ang[num5];
						}
					}
					frame.shapes[l] = shape;
				}
				state.frames[k] = frame;
			}
			motionIKData.states[i] = state;
		}
		return motionIKData;
	}

	public State InitState(string stateName)
	{
		int num = -1;
		if (states != null)
		{
			num = states.Check((State p) => p.name == stateName);
		}
		if (num == -1)
		{
			State[] second = new State[1]
			{
				new State
				{
					name = stateName
				}
			};
			if (states == null)
			{
				states = second;
			}
			else
			{
				states = states.Concat(second).ToArray();
			}
			num = states.Length - 1;
		}
		State obj = states[num];
		InitFrame(obj);
		return obj;
	}

	public void Release()
	{
		states = null;
	}

	public static void InitFrame(State state)
	{
		int ikLen = MotionIK.IKTargetPair.IKTargetLength;
		IEnumerable<Frame> first = from i in Enumerable.Range(0, ikLen)
			select new Frame
			{
				frameNo = i
			};
		IEnumerable<Frame> second = from i in Enumerable.Range(0, FrameCorrect.FrameNames.Length)
			select new Frame
			{
				frameNo = i + ikLen
			};
		IEnumerable<Frame> source = first.Concat(second);
		state.frames = source.ToArray();
		for (int num = 0; num < state.frames.Length; num++)
		{
			InitShape(state.frames[num]);
		}
	}

	public static void InitShape(Frame frame)
	{
		frame.shapes = (from i in Enumerable.Range(0, ChaFileDefine.cf_bodyshapename.Length)
			select new Shape
			{
				shapeNo = i
			}).ToArray();
		for (int num = 0; num < frame.shapes.Length; num++)
		{
			Shape obj = frame.shapes[num];
			obj.small = new PosAng();
			obj.large = new PosAng();
		}
	}

	public bool Read(TextAsset ta)
	{
		bool flag = ta != null;
		if (flag)
		{
			using MemoryStream stream = new MemoryStream(ta.bytes);
			Read(stream);
		}
		return flag;
	}

	public bool Read(string path)
	{
		return Utils.File.OpenRead(path, Read);
	}

	private void Read(Stream stream)
	{
		using BinaryReader binaryReader = new BinaryReader(stream);
		int num = binaryReader.ReadInt32();
		states = new State[num];
		for (int i = 0; i < num; i++)
		{
			State state = new State();
			state.name = binaryReader.ReadString();
			Parts[] parts = state.parts;
			foreach (Parts obj in parts)
			{
				obj.param2.sex = binaryReader.ReadInt32();
				obj.param2.target = binaryReader.ReadString();
				obj.param2.weightPos = binaryReader.ReadSingle();
				obj.param2.weightAng = binaryReader.ReadSingle();
				obj.param3.chein = binaryReader.ReadString();
				obj.param3.weight = binaryReader.ReadSingle();
			}
			int num2 = binaryReader.ReadInt32();
			state.frames = new Frame[num2];
			for (int k = 0; k < num2; k++)
			{
				Frame frame = new Frame();
				frame.frameNo = binaryReader.ReadInt32();
				frame.editNo = binaryReader.ReadInt32();
				int num3 = binaryReader.ReadInt32();
				frame.shapes = new Shape[num3];
				for (int l = 0; l < num3; l++)
				{
					Shape shape = new Shape();
					shape.shapeNo = binaryReader.ReadInt32();
					for (int m = 0; m < 2; m++)
					{
						shape[m] = new PosAng();
						for (int n = 0; n < 3; n++)
						{
							shape[m].pos[n] = binaryReader.ReadSingle();
						}
						for (int num4 = 0; num4 < 3; num4++)
						{
							shape[m].ang[num4] = binaryReader.ReadSingle();
						}
					}
					frame.shapes[l] = shape;
				}
				state.frames[k] = frame;
			}
			states[i] = state;
		}
	}
}
