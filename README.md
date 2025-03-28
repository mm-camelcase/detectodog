## local

jupyter lab --no-browser --port=8888


## 📌 Step 4: Run Experiments Efficiently

Use this **run plan** to minimize GPU cost:

| **Run** | **Batch Size** | **Learning Rate** | **Dropout** | **Augmentation** | **Expected Effect** |
|---------|--------------|-----------------|------------|---------------|-----------------|
| **Baseline (Run 1)** | 32 | 0.00005 | 0.3 | ✅ Yes | Starting point |
| **Run 2** | 64 | 0.00005 | 0.3 | ✅ Yes | Faster training, check accuracy |
| **Run 3** | 32 | 0.000025 | 0.3 | ✅ Yes | Slower updates, better stability? |
| **Run 4** | 32 | 0.00005 | 0.2 | ✅ Yes | Less dropout, better learning? |
| **Run 5** | 32 | 0.00005 | 0.4 | ✅ Yes | More dropout, prevents overfitting? |
| **Run 6** | 32 | 0.00005 | 0.3 | ❌ No | Compare effect of augmentation |
| **Run 7** | 32 | 0.00005 | 0.2 | ❌ No | Same as 4, but 20 epochs instead 10 |
| **Run 8** | 32 | 0.00005 | 0.2 | ✅ Yes | Same as 4, but 20 epochs instead 10, aug.8  |
| **Run 9** | 32 | 0.00005 | 0.2 | ✅ Yes | Same as 4, but 15 epochs |
| **Run 10** | 32 | 0.00005 | 0.2 | ✅ Yes | Same as 4, image_size 224,224  |
| **Run 11** | 32 | 0.00005 | 0.2 | ✅ Yes | Same as 4, image_size 320, 320  |
| **Run 12** | 16 | 0.00005 | 0.2 | ✅ Yes | Same as 4, image_size 224,224, batch size 16  |
| **Run 13** | 16 | 0.00005 | 0.3 | ✅ Yes | ResNet50  |
| **Run 14** | 16 | 0.00005 | 0.3 | ✅ Yes | ResNet50 , image_size = (256, 256) |
| **Run 15** | 16 | 0.00005 | 0.3 | ✅ Yes | ResNet50 , CyclicLR (base_lr = 0.00001, max_lr = 0.00005, step_size = 5) |
| **Run 16** | 16 | 0.00005 | 0.3 | ✅ Yes | ResNet50 , CyclicLR (base_lr = 0.00001, max_lr = 0.00005, step_size = 5) , image_size = (320,320)|
| **Run 17** | 16 | 0.00005 | 0.3 | ✅ Yes | ResNet50 , CyclicLR (base_lr = 0.00001, max_lr = 0.00005, step_size = 5) , image_size = (224, 224) reverted, epochs 20->25|
| **Run 18** | 16 | 0.00005 | 0.3 | ✅ Yes | ResNet50 , CyclicLR (base_lr = 1e-6, max_lr = 5e-5, step_size = 5)   ie step_size_up = 68 * 5 |

✅ **After 3-5 runs, check the logs and pick the best settings!**