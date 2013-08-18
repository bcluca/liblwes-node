#include <arpa/inet.h>
#include <stdio.h>

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

int
lwes_event_attribute_to_string
  (struct lwes_event_attribute *attribute,
   char *buffer,
   int offset)
{
  int n;

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
    n += lwes_LONG_STRING_to_string((LWES_LONG_STRING)attribute->value, buffer, offset + n);
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
