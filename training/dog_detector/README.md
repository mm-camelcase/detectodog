# Dog detector

This experiment adds a dog/not-dog gate before breed results without changing the 120-breed model.

## Data

- Stanford Dogs: dog examples used by the existing project.
- Oxford-IIIT Pet: external dog examples and hard cat negatives, CC BY-SA 4.0.
- Wikimedia Commons: diverse negatives with per-image attribution and an accepted open licence.

Raw images are ignored by Git. Acquisition is deterministic and writes a manifest containing source and licence metadata.

## Run

```bash
python training/dog_detector/acquire.py \
  --stanford-archive /path/to/images.tar
python training/dog_detector/train.py
python training/dog_detector/evaluate.py
```

The detector is logistic regression over the existing breed model's 120 logits. The breed model remains unchanged. The exported detector accepts `breed_logits` and returns `dog_probability`.

## Versions

- Breed model: `detectodog-1.0`
- Detector: `dog-detector-1.0`
- Combined API: `detectodog-2.0`

The decision threshold is selected on validation data and stored with the detector metadata.
