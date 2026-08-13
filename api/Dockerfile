FROM public.ecr.aws/lambda/python:3.12

COPY api/requirements.txt ${LAMBDA_TASK_ROOT}/requirements.txt
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

COPY api/app ${LAMBDA_TASK_ROOT}/app
COPY model ${LAMBDA_TASK_ROOT}/model

ENV MODEL_PATH=${LAMBDA_TASK_ROOT}/model/detectodog.onnx \
    LABELS_PATH=${LAMBDA_TASK_ROOT}/model/breeds.json \
    DETECTOR_PATH=${LAMBDA_TASK_ROOT}/model/dog-detector.onnx \
    DETECTOR_CONFIG_PATH=${LAMBDA_TASK_ROOT}/model/dog-detector.json \
    MODEL_VERSION=detectodog-1.0 \
    API_MODEL_VERSION=detectodog-2.0

CMD ["app.main.handler"]
