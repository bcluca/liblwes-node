CC=emcc
CFLAGS=-O2 -s ASM_JS=1
SOURCES=src/lwes-0.23.2/lwes_*.c
PRE_JS=src/liblwes_pre.js
POST_JS=src/liblwes_post.js
EXT_LIBS=--js-library src/liblwes_ext.js
EXPORTS=-s EXPORTED_FUNCTIONS="['_lwes_emitter_create', '_lwes_event_type_db_create', '_lwes_event_create', '_lwes_event_destroy', '_lwes_emitter_emit', '_lwes_event_set_STRING', '_lwes_event_set_U_INT_16', '_lwes_event_set_INT_16', '_lwes_event_set_U_INT_32', '_lwes_event_set_INT_32', '_lwes_event_set_IP_ADDR_w_string', '_lwes_event_set_INT_64', '_lwes_event_set_U_INT_64', '_lwes_event_set_INT_64_w_string', '_lwes_event_set_U_INT_64_w_string', '_lwes_event_set_BOOLEAN', '_js_send_bytes', '_lwes_event_type_db_get_attr_type', '_lwes_event_type_db_destroy', '_lwes_emitter_destroy']"

liblwes:
	$(CC) $(CFLAGS) -o $@.js --pre-js $(PRE_JS) --post-js $(POST_JS) $(SOURCES) $(EXT_LIBS) $(EXPORTS)

.PHONY: clean

clean:
	rm liblwes.js
