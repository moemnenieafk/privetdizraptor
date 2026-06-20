https://api.tarkov.dev/
https://graphql.org/learn/

[![Tarkov.dev](https://tarkov.dev/tarkov-dev-logo.svg)](https://tarkov.dev/)

# Tarkov.dev API

## О сайте

API написан на GraphQL, и мы изо всех сил стараемся следовать спецификации и не вносить ломающих изменений. Чтобы узнать, какие запросы можно делать и как устроена схема, посетите playground и прочитайте документацию, нажав на значок книги в левом верхнем углу. Когда вы будете готовы попробовать несколько запросов, вы также можете протестировать их в playground. Чтобы узнать о запросах GraphQL в целом, на сайте GraphQL Foundation есть полезные ресурсы.

- [Tarkov.dev GraphQL playground](https://api.tarkov.dev/)
- [GraphQL Foundation resources](https://graphql.org/learn/)

Когда вы будете готовы отправлять API-запросы не из playground, endpoint находится по адресу: [https://api.tarkov.dev/graphql](https://api.tarkov.dev/graphql).

## ЧаВо

### Бесплатно ли это?

Да

### Является ли это открытым исходным кодом?

Конечно! Исходный код API можно найти в его репозитории на GitHub: [github.com/the-hideout/tarkov-api](https://github.com/the-hideout/tarkov-api).

### Есть ли ограничение на частоту запросов?

Периодически на нас обрушивается куча трафика от злоумышленников, что требует использования системы рейт-лимитов. Данные по ценам обновляются раз в 5 минут, поэтому нет особой нужды делать запросы чаще. Пользуйтесь здравым смыслом, и всё будет в порядке.

### Что насчет кэширования?

Поскольку наши данные обновляются каждые 5 минут, мы также кэшируем все GraphQL-запросы в течение 5 минут. Это позволяет значительно снизить нагрузку на наши серверы и ускорить выполнение ваших запросов!

### Откуда берутся данные?

Мы получаем данные из разных мест, чтобы создать максимально полный API. Мы используем данные из:

- [Tarkov Changes](https://tarkov-changes.com/)
- [Escape from Tarkov Wiki](https://escapefromtarkov.fandom.com/wiki/Escape_from_Tarkov_Wiki)
- [TarkovTracker/tarkovdata](https://github.com/TarkovTracker/tarkovdata/)
- Нашей сети сканеров

## Примеры

- [Browser JS](https://tarkov.dev/api/#browser-js)
- [Node JS](https://tarkov.dev/api/#node-js)
- [Python](https://tarkov.dev/api/#python)
- [Ruby](https://tarkov.dev/api/#ruby)
- [CLI](https://tarkov.dev/api/#cli)
- [PHP](https://tarkov.dev/api/#php)
- [Java 11](https://tarkov.dev/api/#java-11)
- [C#](https://tarkov.dev/api/#csharp)
- [Golang](https://tarkov.dev/api/#go)
- [Lua (Luvit)](https://tarkov.dev/api/#luvit)

### Browser JS пример

```javascript
fetch('https://api.tarkov.dev/graphql', {
  method: 'POST',
  headers: {
    'Accept': 'application/json',
  },
  body: JSON.stringify({query: `{
    items {
        id
        name
        shortName
    }
}`})
})
  .then(r => r.json())
  .then(data => console.log('data returned:', data));
```

### Node JS пример

```javascript
import { request, gql } from 'graphql-request'

const query = gql`
{
    items {
        id
        name
        shortName
    }
}
`

request('https://api.tarkov.dev/graphql', query).then((data) => console.log(data))
```

### Python пример

```python
import requests

def run_query(query):
    headers = {"Content-Type": "application/json"}
    response = requests.post('https://api.tarkov.dev/graphql', headers=headers, json={'query': query})
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception("Query failed to run by returning code of {}. {}".format(response.status_code, query))


new_query = """
{
    items {
        id
        name
        shortName
    }
}
"""

result = run_query(new_query)
print(result)
```

### Ruby пример

Предоставленно [GrantBirki](https://github.com/GrantBirki)

```ruby
# frozen_string_literal: true

require 'net/http'
require 'uri'
require 'json'

uri = URI.parse("https://api.tarkov.dev/graphql")

header = { "Content-Type": "application/json" }
query = { "query": "{ items {id name shortName } }" }

# Create the HTTP object
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true
request = Net::HTTP::Post.new(uri.request_uri, header)
request.body = query.to_json

# Send the request
response = http.request(request)

# Display request results
puts response.code
puts response.message
puts response.body
```

### CLI пример

```bash
curl -X POST -H "Content-Type: application/json" -d '{"query": "{ items {id name shortName } }"}' https://api.tarkov.dev/graphql
```

### PHP пример

```php
$headers = ['Content-Type: application/json'];

$query = '{
  items {
    id
    name
    shortName
  }
}';
$data = @file_get_contents('https://api.tarkov.dev/graphql', false, stream_context_create([
  'http' => [
    'method' => 'POST',
    'header' => $headers,
    'content' => json_encode(['query' => $query]),
  ]
]));
return json_decode($data, true);
```

### Java 11's HttpClient примерПредоставленно [HeyBanditoz](https://github.com/HeyBanditoz)

```java
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

class Scratch {
    public static void main(String[] args) throws IOException, InterruptedException {
        HttpClient client = HttpClient.newBuilder().build();
        String query = "{\"query\": \"{ items {id name shortName } }\"}";
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://api.tarkov.dev/graphql"))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(query))
                .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        String jsonString = response.body();
        System.out.println(jsonString);
    }
}
```

### C# примерПредоставленно BambusBo

```csharp
var data = new Dictionary<string, string>()
{
    {"query", "{items { id name shortName }}"}
};

using (var httpClient = new HttpClient())
{

    //Http response message
    var httpResponse = await httpClient.PostAsJsonAsync("https://api.tarkov.dev/graphql", data);

    //Response content
    var responseContent = await httpResponse.Content.ReadAsStringAsync();

    //Print response
    Debug.WriteLine(responseContent);

}
```

### Go примерПредоставленно [HeyBanditoz](https://github.com/HeyBanditoz)

```go
package main

import (
    "fmt"
    "io"
    "log"
    "net/http"
    "strings"
)

func main() {
    body := strings.NewReader(`{"query": "{ items {id name shortName } }"}`)
    req, err := http.NewRequest("POST", "https://api.tarkov.dev/graphql", body)
    if err != nil {
        log.Fatalln(err)
    }
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Accept", "application/json")

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        log.Fatalln(err)
    }
    bodyBytes, err := io.ReadAll(resp.Body)
    if err != nil {
        log.Fatalln(err)
    }
    bodyString := string(bodyBytes)
    fmt.Println(bodyString)

    defer resp.Body.Close()
}
```

### Lua (Luvit) примерПредоставленно [AntwanR942](https://github.com/AntwanR942)

```lua
local http = require "coro-http"

coroutine.wrap(function()
    local query = [[{"query": "{ items {id name shortName } }"}]]
    local headers = {
        { "Content-Type", "application/json" },
        { "Accept", "application/json" }
    }
    local res, body = http.request("POST", "https://api.tarkov.dev/graphql", headers, query)
    if res.code ~= 200 then
        error(res.message)
    end

    print(body)
end)()
```

ID для удаленного управления?>>

Нажмите для подключения0

### Tarkov.dev

Вся платформа имеет открытый исходный код и ориентирована на разработчиков. Весь код доступен на  [GitHub](https://github.com/the-hideout/tarkov-dev).

Если вы хотите пообщаться, задать вопросы или запросить функции, у нас есть  [Discord](https://discord.gg/WwTvNe356u) сервер.

Читайте наш  [X](https://x.com/tarkov_dev) для всех последних обновлений.

[О сайте tarkov.dev](https://tarkov.dev/about)

### Данные предметов

Свежие данные EFT любезно предоставлены [Tarkov-Changes](https://tarkov-changes.com/)
Дополнительные данные любезно предоставлены [SPT](https://www.sp-tarkov.com/)

### Map Icons

Map marker icons by [The Official Escape From Tarkov Wiki](https://escapefromtarkov.fandom.com/wiki/Escape_from_Tarkov_Wiki)

### Ресурсы

[Tarkov.dev API](https://tarkov.dev/api/)

[Tarkov Monitor](https://tarkov.dev/tarkov-monitor)

[Интеграция Moobot](https://tarkov.dev/moobot)

[Интеграция Nightbot](https://tarkov.dev/nightbot/)

[Интеграция StreamElements](https://tarkov.dev/streamelements/)

[Discord-бот Stash](https://tarkov.dev/stash-discord-bot)

### Внешние ресурсы

[TarkovTracker.org](https://tarkovtracker.org/)

[RatScanner](https://github.com/RatScanner/RatScanner)

Tarkov.dev является форком уже закрытого tarkov-tools.com | Большое спасибо kokarn за всю его работу по созданию Tarkov Tools и сообщества вокруг него.

Игровой контент и материалы являются торговыми марками и авторскими правами Battlestate Games и ее лицензиаров. Все права защищены.

версия : [d7060e2](https://github.com/the-hideout/tarkov-dev/commits/d7060e2)






