"""Bounded retries for transient upstream failures, honoring short Retry-After delays."""
import time
import urllib.error
import urllib.request

def open_download(request, timeout=120):
    for attempt in range(5):
        try:
            return urllib.request.urlopen(request, timeout=timeout)
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 502, 503, 504) or attempt == 4:
                raise
            retry_after = exc.headers.get('Retry-After', '')
            delay = min(int(retry_after), 60) if retry_after.isdigit() else 2 ** (attempt + 1)
            time.sleep(max(1, delay))
