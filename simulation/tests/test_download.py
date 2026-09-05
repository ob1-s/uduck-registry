import unittest
import urllib.error
from unittest.mock import patch
from http_download import open_download

class DownloadTests(unittest.TestCase):
    def test_retries_rate_limit_with_retry_after(self):
        failure = urllib.error.HTTPError('https://huggingface.co/a/b',429,'rate limit',{'Retry-After':'3'},None)
        with patch('http_download.urllib.request.urlopen',side_effect=[failure,'response']), patch('http_download.time.sleep') as sleep:
            self.assertEqual(open_download('request'),'response')
            sleep.assert_called_once_with(3)
    def test_does_not_retry_missing_artifact(self):
        failure = urllib.error.HTTPError('https://huggingface.co/a/b',404,'missing',{},None)
        with patch('http_download.urllib.request.urlopen',side_effect=failure) as request:
            with self.assertRaises(urllib.error.HTTPError): open_download('request')
            self.assertEqual(request.call_count,1)
