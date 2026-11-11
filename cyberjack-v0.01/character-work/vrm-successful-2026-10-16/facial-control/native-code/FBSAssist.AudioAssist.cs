using UnityEngine;

namespace FBSAssist;

public class AudioAssist
{
	private float beforeVolume;

	private float RMS(ref float[] samples)
	{
		float num = 0f;
		for (int i = 0; i < samples.Length; i++)
		{
			num += samples[i] * samples[i];
		}
		num /= (float)samples.Length;
		return Mathf.Sqrt(num);
	}

	public float GetAudioWaveValue(AudioSource audioSource, float correct = 2f)
	{
		float result = 0f;
		if (!audioSource.clip)
		{
			return result;
		}
		if (audioSource.isPlaying)
		{
			float[] samples = new float[1024];
			float max = 1f;
			audioSource.GetOutputData(samples, 0);
			float num = Mathf.Clamp(RMS(ref samples) * correct, 0f, max);
			result = ((!(num < beforeVolume)) ? ((num + beforeVolume) * 0.5f) : (num * 0.2f + beforeVolume * 0.8f));
			beforeVolume = num;
		}
		return result;
	}
}
