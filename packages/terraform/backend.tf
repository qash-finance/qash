terraform {
  backend "gcs" {
    prefix = "terraform/state"
    # bucket is set via -backend-config="bucket=<BUCKET_NAME>" at init time
  }
}
