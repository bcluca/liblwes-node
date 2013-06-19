#ifndef __LWES_JS_EXT_H
#define __LWES_JS_EXT_H

#include "lwes_types.h"

#ifdef __cplusplus
extern "C" {
#endif

extern int js_send_bytes(LWES_INT_32 js_emitter, LWES_BYTE_P bytes, size_t length);

#ifdef __cplusplus
}
#endif

#endif /* __LWES_JS_EXT_H */
