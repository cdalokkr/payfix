FROM anaconda/miniconda:latest

WORKDIR /code

RUN apt-get update && apt-get install -y --no-install-recommends \
    libx11-6 \
    libgl1 \
    libglib2.0-0 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN conda config --remove channels defaults || true
RUN conda install --override-channels -c conda-forge -y \
    dlib \
    face_recognition \
    fastapi \
    uvicorn \
    pillow \
    numpy \
    python-multipart \
    pydantic

ENV PATH=/opt/miniconda3/bin:$PATH

RUN /opt/miniconda3/bin/pip install --no-cache-dir "setuptools<82.0.0"
RUN chmod -R a+rX /opt/miniconda3

COPY main.py /code/main.py

EXPOSE 7860

CMD ["/opt/miniconda3/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]