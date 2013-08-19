#include <arpa/inet.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <stddef.h>

#include "lwes_js_ext.h"

int
lwes_U_INT_16_to_string
  (LWES_U_INT_16 a_uint16,
   char *buffer,
   int offset)
{
  return sprintf(buffer + offset, "%hu", a_uint16);
}

int
lwes_INT_16_to_string
  (LWES_INT_16 an_int16,
   char *buffer,
   int offset)
{
  return sprintf(buffer + offset, "%hd", an_int16);
}

int
lwes_U_INT_32_to_string
  (LWES_U_INT_32 a_uint32,
   char *buffer,
   int offset)
{
  return sprintf(buffer + offset, "%u" ,a_uint32);
}

int
lwes_INT_32_to_string
  (LWES_INT_32 an_int32,
   char *buffer,
   int offset)
{
  return sprintf(buffer + offset, "%d", an_int32);
}

int
lwes_U_INT_64_to_string
  (LWES_U_INT_64 a_uint64,
   char *buffer,
   int offset)
{
  return sprintf(buffer + offset, "%llu", a_uint64);
}

int
lwes_INT_64_to_string
  (LWES_INT_64 an_int64,
   char *buffer,
   int offset)
{
  return sprintf(buffer + offset, "%lld", an_int64);
}

int
lwes_BOOLEAN_to_string
  (LWES_BOOLEAN a_boolean,
   char *buffer,
   int offset)
{
  return sprintf(buffer + offset, "%s", ((a_boolean==1) ? "true" : "false"));
}

int
lwes_IP_ADDR_to_string
  (LWES_IP_ADDR an_ipaddr,
   char *buffer,
   int offset)
{
  return sprintf(buffer + offset, "%s", inet_ntoa(an_ipaddr));
}

int
lwes_SHORT_STRING_to_string
  (LWES_SHORT_STRING a_string,
   char *buffer,
   int offset)
{
  return sprintf(buffer + offset, "%s", a_string);
}

int
lwes_LONG_STRING_to_string
  (LWES_LONG_STRING a_string,
   char *buffer,
   int offset)
{
  return sprintf(buffer + offset, "%s", a_string);
}

/*
 * Replaces in the string 'str' all the occurrences of the source string 'old'
 * with the destination string 'new'. The parameters 'old' and 'new' can be of
 * any length, and their lengths are allowed to differ.
 *
 * Returns the post-replacement string, or NULL if memory for the new string
 * could not be allocated. Does not modify the original string. The memory for
 * the returned post-replacement string must be deallocated by the caller.
 *
 */
char *replace_str(const char *str, const char *old, const char *new)
{
  char *ret, *r;
  const char *p, *q;
  size_t oldlen = strlen(old);
  size_t count, retlen, newlen = strlen(new);

  if (oldlen != newlen) {
    for (count = 0, p = str; (q = strstr(p, old)) != NULL; p = q + oldlen)
      count++;
    /* this is undefined if p - str > PTRDIFF_MAX */
    retlen = p - str + strlen(p) + count * (newlen - oldlen);
  } else
    retlen = strlen(str);

  if ((ret = malloc(retlen + 1)) == NULL)
    return NULL;

  for (r = ret, p = str; (q = strstr(p, old)) != NULL; p = q + oldlen) {
    /* this is undefined if q - p > PTRDIFF_MAX */
    ptrdiff_t l = q - p;
    memcpy(r, p, l);
    r += l;
    memcpy(r, new, newlen);
    r += newlen;
  }
  strcpy(r, p);

  return ret;
}

char *escape_for_json(const char *str)
{
  char *tmp_buf1;
  char *tmp_buf2;

  tmp_buf1 = replace_str((char *)str, "\\", "\\\\");
  if (tmp_buf1 != NULL)
  {
    tmp_buf2 = replace_str((char *)tmp_buf1, "\n", "\\n");
    free(tmp_buf1);
    if (tmp_buf2 != NULL)
    {
      tmp_buf1 = replace_str(tmp_buf2, "\"", "\\\"");
      free(tmp_buf2);
      if (tmp_buf1 != NULL)
      {
        return tmp_buf1;
      }
    }
  }

  return NULL;
}

int
lwes_event_attribute_to_string
  (struct lwes_event_attribute *attribute,
   char *buffer,
   int offset)
{
  int n;
  char *tmp_buffer;

  if (attribute->type == LWES_U_INT_16_TOKEN)
  {
    return lwes_U_INT_16_to_string(*((LWES_U_INT_16 *)attribute->value), buffer, offset);
  }
  else if (attribute->type == LWES_INT_16_TOKEN)
  {
    return lwes_INT_16_to_string(*((LWES_INT_16 *)attribute->value), buffer, offset);
  }
  else if (attribute->type == LWES_U_INT_32_TOKEN)
  {
    return lwes_U_INT_32_to_string(*((LWES_U_INT_32 *)attribute->value), buffer, offset);
  }
  else if (attribute->type == LWES_INT_32_TOKEN)
  {
    return lwes_INT_32_to_string(*((LWES_INT_32 *)attribute->value), buffer, offset);
  }
  else if (attribute->type == LWES_U_INT_64_TOKEN)
  {
    n = sprintf(buffer + offset, "\"");
    n += lwes_U_INT_64_to_string(*((LWES_U_INT_64 *)attribute->value), buffer, offset + n);
    n += sprintf(buffer + offset + n, "\"");
    return n;
  }
  else if (attribute->type == LWES_INT_64_TOKEN)
  {
    n = sprintf(buffer + offset, "\"");
    n += lwes_INT_64_to_string(*((LWES_INT_64 *)attribute->value), buffer, offset + n);
    n += sprintf(buffer + offset + n, "\"");
    return n;
  }
  else if (attribute->type == LWES_BOOLEAN_TOKEN)
  {
    return lwes_BOOLEAN_to_string(*((LWES_BOOLEAN *)attribute->value), buffer, offset);
  }
  else if (attribute->type == LWES_IP_ADDR_TOKEN)
  {
    n = sprintf(buffer + offset, "\"");
    n += lwes_IP_ADDR_to_string(*((LWES_IP_ADDR *)attribute->value), buffer, offset + n);
    n += sprintf(buffer + offset + n, "\"");
    return n;
  }
  else if (attribute->type == LWES_STRING_TOKEN)
  {
    n = sprintf(buffer + offset, "\"");
    tmp_buffer = escape_for_json((char *)attribute->value);
    if (tmp_buffer != NULL)
    {
      n += lwes_LONG_STRING_to_string((LWES_LONG_STRING)tmp_buffer, buffer, offset + n);
      free(tmp_buffer);
    }
    n += sprintf(buffer + offset + n, "\"");
    return n;
  }
  return 0;
}

/*
 * Serializes an LWES event to JSON, to facilitate data exchange with Javascript
 *
 */
char *
lwes_event_to_json
  (struct lwes_event *event,
   char *buffer)
{
  struct lwes_event_attribute *tmp;
  struct lwes_hash_enumeration e;
  int i, n = 0;

  i = sprintf(buffer, "{\"type\":\"");
  i += lwes_SHORT_STRING_to_string(event->eventName, buffer, i);
  i += sprintf(buffer + i, "\",\"attributes\":{");

  if (lwes_hash_keys(event->attributes, &e))
  {
    while (lwes_hash_enumeration_has_more_elements(&e))
    {
      LWES_SHORT_STRING tmpAttrName = lwes_hash_enumeration_next_element(&e);

      tmp = (struct lwes_event_attribute *)lwes_hash_get(event->attributes,
                                                      tmpAttrName);

      if (n > 0) i += sprintf(buffer + i, ",");
      i += sprintf(buffer + i, "\"");
      i += lwes_SHORT_STRING_to_string(tmpAttrName, buffer, i);
      i += sprintf(buffer + i, "\":");
      i += lwes_event_attribute_to_string(tmp, buffer, i);
      n++;
    }
  }

  sprintf(buffer + i, "}}");

  return buffer;
}
