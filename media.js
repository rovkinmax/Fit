// Register listeners before checking complete: both cached and in-flight images
// must reach the same state, including images that failed before this script ran.
document.querySelectorAll('.exercise-media img').forEach((image) => {
  const settle = () => {
    image.dataset.mediaState = image.naturalWidth > 0 ? 'loaded' : 'error';
  };
  image.addEventListener('load', settle, { once: true });
  image.addEventListener('error', settle, { once: true });
  if (image.complete) settle();
  else image.dataset.mediaState = 'loading';
});
