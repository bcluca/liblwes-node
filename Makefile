CC=emcc
CFLAGS=-O3 -s ASM_JS=1 --memory-init-file 0
SOURCES=src/lwes-0.23.2/lwes_*.c
POST_JS=src/liblwes.js
EXT_LIBS=--js-library src/lwes_ext.js
EXPORTS=-s EXPORTED_FUNCTIONS="['_lwes_emitter_create', '_lwes_event_type_db_create', '_lwes_event_create', '_lwes_event_destroy', '_lwes_emitter_emit', '_lwes_event_set_STRING', '_lwes_event_set_U_INT_16', '_lwes_event_set_INT_16', '_lwes_event_set_U_INT_32', '_lwes_event_set_INT_32', '_lwes_event_set_IP_ADDR_w_string', '_lwes_event_set_INT_64_w_string', '_lwes_event_set_U_INT_64_w_string', '_lwes_event_set_BOOLEAN', '_js_send_bytes', '_lwes_event_type_db_get_attr_type', '_lwes_event_type_db_destroy', '_lwes_emitter_destroy', '_lwes_event_create_no_name', '_lwes_event_from_bytes', '_lwes_event_to_json']"

liblwes:
	$(CC) $(CFLAGS) -o $@.js --post-js $(POST_JS) $(SOURCES) $(EXT_LIBS) $(EXPORTS)

.PHONY: clean

clean:
	rm liblwes.js
