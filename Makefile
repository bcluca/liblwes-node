CC=emcc
CFLAGS=-O2 -s ASM_JS=1
SOURCES=src/lwes-0.23.2/lwes_*.c
PRE_JS=src/liblwes_pre.js
POST_JS=src/liblwes_post.js
FS_EMBED=--embed-file data
EXT_LIBS=--js-library src/liblwes_ext.js
EXPORTS=-s EXPORTED_FUNCTIONS="['_lwes_emitter_create', '_lwes_event_type_db_create', '_lwes_event_create', '_lwes_event_destroy', '_lwes_emitter_emit', '_lwes_event_set_STRING', '_js_send_bytes']"

liblwes:
	$(CC) $(CFLAGS) -o $@.js --pre-js $(PRE_JS) --post-js $(POST_JS) $(FS_EMBED) $(SOURCES) $(EXT_LIBS) $(EXPORTS)

.PHONY: clean

clean:
	rm liblwes.js
