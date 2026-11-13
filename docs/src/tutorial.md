# Run shared pointers

Install the example dependencies:

```bash
pip install "spaday-collab[examples]"
python -m spaday_collab.example
```

Open http://127.0.0.1:8044/ in one browser and http://127.0.0.1:8044/bob in another. Move Alice's pointer over the note. Bob's browser shows an orange arrow and label over the same part of the note.

Resize Bob's window and move Alice's pointer again. The pointer remains relative to the note, even when each window has a different layout.

Edit the note in either browser. Both display the updated text through the same transports connection that exchanges pointer awareness. Move outside the targets or close one browser; its pointer disappears from the other.

See [the example source](https://github.com/1kbgz/spaday-collab/blob/main/spaday_collab/example.py) for the Python page and [the awareness mapping](https://github.com/1kbgz/spaday-collab/blob/main/js/examples/example.js) for the application adapter.
