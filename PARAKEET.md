### **Input:**

Input Type(s): 16kHz Audio Input Format(s): .wav and .flac audio formats Input Parameters: 1D (audio signal) Other Properties Related to Input: Monochannel audio

### **Output:**

Output Type(s): Text Output Format: String Output Parameters: 1D (text) Other Properties Related to Output: Punctuations and Capitalizations included.

Our AI models are designed and/or optimized to run on NVIDIA GPU-accelerated systems. By leveraging NVIDIA's hardware (e.g. GPU cores) and software frameworks (e.g., CUDA libraries), the model achieves faster training and inference times compared to CPU-only solutions.

For more information, refer to the [NeMo documentation](https://docs.nvidia.com/deeplearning/nemo/user-guide/docs/en/main/asr/models.html#fast-conformer).

## **How to Use this Model:**

To train, fine-tune or play with the model you will need to install [NVIDIA NeMo](https://github.com/NVIDIA/NeMo). We recommend you install it after you've installed latest PyTorch version.

```shell
pip install -U nemo_toolkit['asr']
```

The model is available for use in the NeMo toolkit \[5\], and can be used as a pre-trained checkpoint for inference or for fine-tuning on another dataset.

#### **Automatically instantiate the model**

```py
import nemo.collections.asr as nemo_asr
asr_model = nemo_asr.models.ASRModel.from_pretrained(model_name="nvidia/parakeet-tdt-0.6b-v3")
```

#### **Transcribing using Python**

First, let's get a sample

```shell
wget https://dldata-public.s3.us-east-2.amazonaws.com/2086-149220-0033.wav
```

Then simply do:

```py
output = asr_model.transcribe(['2086-149220-0033.wav'])
print(output[0].text)
```

