# 1) Base image: small + modern python
FROM python:3.11-slim

# 2) Security: create a non-root user (containers should not run as root)
RUN useradd -m appuser

# 3) Workdir inside container
WORKDIR /app

# 4) Copy dependency list first (better caching)
COPY requirements.txt .

# 5) Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# 6) Copy application code
COPY . .

# 7) Change ownership and switch to non-root user
RUN chown -R appuser:appuser /app
USER appuser

# 8) Expose container port (informational; Kubernetes still controls networking)
EXPOSE 5000

# 9) Run production server (Gunicorn)
# wsgi:app means: file wsgi.py, variable app inside it
CMD ["gunicorn", "-b", "0.0.0.0:5000", "wsgi:app"]