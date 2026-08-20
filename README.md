#      

-      :  
  ,     
 **YandexGPT**   ,    (   
 +      ),  
 ,         (~24  ).
  (    ) 
    .

    :

- **`client/`**    **Vite + React**, ,   CSS Modules
  (    `*.module.css`),   **Redux + Redux
  Thunk** (`client/src/store/`).   **Comfortaa** ( ) 
  **JetBrains Mono** (/  ), 
   Google Fonts  `client/index.html`,  `--font-main` /
  `--font-mono`  `client/src/styles/variables.css`.     Google
  Fonts ,  CDN-   
  `@fontsource/comfortaa`  `@fontsource/jetbrains-mono`.
- **`server/`**  API  **Express** (Node.js, ESM):   ,
      YandexGPT (  
    , `node-cron`),  
  (JWT)   .

##  

```bash
#   
npm run install:all      #    client/  server/

cp server/.env.example server/.env   #    YANDEX_API_KEY / YANDEX_FOLDER_ID
cp client/.env.example client/.env   #     API

#        server/.env (ADMIN_PASSWORD_HASH)
cd server && node scripts/hash-password.js "" && cd ..

npm run dev               #   (:4000)   (:5173) 
```

 ,   :

```bash
cd server && npm install && npm run dev     # http://localhost:4000
cd client && npm install && npm run dev     # http://localhost:5173
```

 dev- (`client/vite.config.js`, `server.host: "0.0.0.0"`)  
 ,    `localhost`  ,   
`npm run dev`     IP-     
(Vite       `Network: http://<IP>:5173/`,
    ).        
 `host`  `server`  `vite.config.js`,    
  `localhost`.     ,  
 `CLIENT_ORIGIN`  `server/.env`,   API   CORS 
       (,
`http://192.168.1.42:5173`).

>  ,    ,     npm-,
>  `npm install`   .    
>  (`node --check`  , `tsc --noEmit`  JSX-
> ),   -     `npm run dev`
>   ,     .

## 

```
client/
  src/
    api/
      instructionsApi.js             fetch  /api/instructions/*
      authApi.js                     fetch  /api/auth/*
    store/                         Redux + Redux Thunk
      index.js                     createStore(rootReducer, applyMiddleware(thunk))
      rootReducer.js                combineReducers({ auth, instructions })
      authSlice.js                    + thunk' login/logout/restoreSession
      instructionsSlice.js          //  + thunk'
                                      search/fetch/generate/upload/delete
    hooks/useDebouncedValue.js       
    components/
      Header/                       ( +   + -)
      SearchBar/                    
      AuthControl/                   /    
      LoginModal/                    
      GenerateInstructionButton/    +    
                                      (  ) +    
      AddInstructionButton/         +     (
                                       ) +    /  
      SiteLinkButton/              -,   boykovgroup.ru
      InstructionList/               
      InstructionButton/             + - 
      Pagination/                   ( +  )
      EmptyState/                  "  " (+    )
      InstructionModal/                
      Loader/                       
    App.jsx                         store,  

server/
  src/
    index.js                         Express,   cron-
    middleware/auth.js             attachUser ( JWT), requireAdmin ( )
    jobs/
      dailyGenerationJob.js        cron- ,      (node-cron)
    routes/
      auth.js                      POST /api/auth/login, GET /api/auth/me
      instructions.js              GET /api/instructions, GET /:id,
                                      POST /generate, POST /upload  DELETE /:id 
                                        , POST /run-scheduled-generation
                                          (   )
    services/
      authService.js                /,    JWT
      instructionsRepository.js       (JSON)
      searchService.js               (Fuse.js) + 
      yandexGptService.js           Yandex Foundation Models API
      documentTextExtractor.js         
                                      (PDF  pdf-parse, DOCX  mammoth, TXT/MD   )
      scheduledGenerationService.js   :  
                                            
                                       (  cron-,
                                        admin-)
    prompts/
      generateInstructionPrompt.js    YandexGPT (. )
    data/
      instructions/*.json            (7     seed-)
      professionQueue.json             (180 .)
  scripts/
    hash-password.js                bcrypt-   .env
```

##   

           
   (  350 )    :

```
GET /api/instructions?q=<>&page=<>&pageSize=6
```

    / (`fuse.js`,  ,
 )       .
       :

```
GET /api/instructions/:id
```

##  

        
  ,    `server/.env` ( 
       ).

1.   : `node server/scripts/hash-password.js ""`.
2.   `server/.env`: `ADMIN_LOGIN` ()  `ADMIN_PASSWORD_HASH`
   (   1),   `JWT_SECRET`     .
3.        ( `AuthControl`) 
    `LoginModal`.    JWT (`POST /api/auth/login`),
      `localStorage`     
   `Authorization: Bearer <token>`  /.  
         `GET /api/auth/me`
   (thunk `restoreSession`)      , 
   .

     :   -   
 `POST /api/instructions/generate`  `DELETE /api/instructions/:id`
    , middleware `requireAdmin` 
`401`.     (`GET`)   .

##       ( )

     :

1. ** +    ** (
   `GenerateInstructionButton`,   ,   
      `[ : ... ]`)   ,   
    ,       .
2.   **** -,    ,   
         YandexGPT  
          (
        ,   
     .     
   ).

       :

```
POST /api/instructions/generate
Authorization: Bearer <token >
Body: { "profession": "< >" }
```

       `[  ]`  
  -  ?  /    
,   `confirm()` .  :

```
DELETE /api/instructions/:id
Authorization: Bearer <token >
```

 (`server/src/services/yandexGptService.js`):

1.            5  
    `server/src/prompts/generateInstructionPrompt.js`.
2.    Yandex Foundation Models
   (`https://llm.api.cloud.yandex.net/foundationModels/v1/completion`)
   **,     ** (   
     ),   .
3.         N.M.  
       (5  ,   
    ).
4.      JSON- 
   `server/src/data/instructions/`      
     ,   .

### 

 `server/src/prompts/generateInstructionPrompt.js`  ,
   (     Ȼ,  
04.04.2025)    API-.   
 : 5       (17 / 10 / 14 / 13 / 11
  15 ),     
   200 ,     , 
 ,      .

    .     
** **:        
      ,   ,  
   17   200+  ,    
            (
  ,      12  ).  
 API    ,    
      : `generateInstructionWithYandexGpt()` 
 **5  **        
  (`messages`),       ,  
 .          
           
(`server/src/services/yandexGptService.js`, retry-),  
      ,    
 .

 :      56  
YandexGPT ,   ,      (
 ).      
      ,   .

###    

         
 (     -,   
-),    YandexGPT    
      .   
**    **,      
`getProfessionGenitive()`  `server/src/utils/professionGenitive.js`:

1.   180    
   (`server/src/data/professionQueue.json`)  ,  
      
   `server/src/data/professionGenitiveOverrides.js`.   
     .
2.        (  
   )       
   /.    
     ,      
     .

       -    
   `professionGenitiveOverrides.js` (   
).

**      **,   
    (,     ): 
```
node scripts/fix-generated-titles.js          #  ,  
node scripts/fix-generated-titles.js --write   #   
```
      `source: "generated"`, 
    `getProfessionGenitive()` ,    
,    .   
(`source: "uploaded"`)  - (`source: "seed"`)  .

##    (  ,  )

   YandexGPT,     
   **+  **   (
`AddInstructionButton`,    ).   
    /,     
,     (  /  ):

```
POST /api/instructions/upload
Authorization: Bearer <token >
Content-Type: multipart/form-data

title: <>
profession: </>
file: <>                
content: <>             
```

    **PDF**, **DOCX**, **TXT**, **MD**:

1. `.txt` / `.md`    .
2. `.pdf`     `pdf-parse`.
3. `.docx`     `mammoth`.
4.   **`.doc`** ( `.docx`) mammoth     
           `.docx`/`.pdf`
      .
5.     **15 ** (`server/src/routes/instructions.js`).
6.     (PDF-  OCR)    
         .

     (    ;  ,
    PDF,        
  )       
     5   
,     .  
     :    (
/),        , 
    `[  ]`  .

    `source: "uploaded"`, `uploadedBy: "admin"`,
`fileType` (    `"manual"`   ) 
`originalFileName`   /,    .

##    

   ,  ,   ,
     **  ~24   **
(  ;  20-30         
 cron-,    ):

1.    (`server/src/index.js`)  
   cron- `server/src/jobs/dailyGenerationJob.js` ( `node-cron`).
       ** ** ( 
     )    
   `DAILY_GENERATION_CRON`  `server/.env`   cron-
   (, `0 */2 * * *`   2 ,   12   , 
   24     ). **      
   `server/.env`   ,  ** (,
   `0 3,11,19 * * *`    3   ),  
            
   .     ,  
   `DAILY_GENERATION_CRON=...`   `server/.env`  ( 
    ,       ).
   : cron      ,  
            
   ,   ,    (
     ),    
   .     5-6   
   YandexGPT,       ,  
      -,  .
2. ,   `runScheduledGeneration()`
   (`server/src/services/scheduledGenerationService.js`):   
    `server/src/data/professionQueue.json` (180 ) ,
         ,      
   YandexGPT    ,    ,   
    .
3.      JSON- 
   `server/src/data/instructions/`,   `generatedBy: "schedule"` 
      `generatedBy: "admin"`  ,  
      .   `id`     
    ,    /.
4.  YandexGPT   ( `YANDEX_API_KEY`/`YANDEX_FOLDER_ID`) 
       ,    
            .

###     

      :

- **  .** `id`    `slugify(profession)`
  (`server/src/utils/slug.js`),       
   id.  (`professionQueue.json`)    
     ,      id,    
  ( ,    )   
  `instructionsRepository`:     id  ,  
  ,     YandexGPT  .
- **  .**      5-6
     YandexGPT (.   ) 
    . ,        
    , ,    
    +   (   
    ),      ,  
      .   :
  `server/src/services/generationLock.js`     id, 
  ,           
      ;      
   id   ,     ,
      YandexGPT .    
    :    , 
  +    ,   
  (`scheduledGenerationService.js`).

          
 (    1-2 ),   
     ,    .

 180     ~24    
      (180 / 24  7.5 ).   
        ,   
        ,   . 
        
  `server/src/data/professionQueue.json` ( JSON- ).

 ,     ,  
    :

```
POST /api/instructions/run-scheduled-generation
Authorization: Bearer <token >
```

         JSON-  
`server/src/data/professionQueue.json`,       
  ,     .

###    (`server/.env`)

```
PORT=4000
CLIENT_ORIGIN=http://localhost:5173

YANDEX_API_KEY=            # API-   Yandex Cloud
YANDEX_FOLDER_ID=          # ID   Yandex Cloud
YANDEX_GPT_MODEL=yandexgpt/latest

JWT_SECRET=                #    
JWT_EXPIRES_IN=12h
ADMIN_LOGIN=admin
ADMIN_PASSWORD_HASH=       #  node scripts/hash-password.js ""

DAILY_GENERATION_CRON=0 * * * *   #  ,      (cron-)
```

  ID     Yandex Cloud
(https://console.yandex.cloud)      
`ai.languageModels.user`  API-  .  `YANDEX_API_KEY`/
`YANDEX_FOLDER_ID`      ,  
    503.  `ADMIN_LOGIN`/`ADMIN_PASSWORD_HASH`
        (503  `/login`),
      .

## Redux- 

     (`combineReducers`,  Redux Toolkit 
 `redux` + `redux-thunk`,   ):

- **`auth`** (`store/authSlice.js`)  ,  , 
  / . Thunk': `login`, `logout`, `restoreSession`.
- **`instructions`** (`store/instructionsSlice.js`)   ,
   ,  //. Thunk':
  `searchInstructions`, `fetchInstruction`, `generateInstruction`,
  `uploadInstruction`, `deleteInstruction`.

         
        
( ),    `useState`  `App`,    
.  Redux   ,     
     ,     /
  Redux DevTools.

##    

 `client/src/components/SiteLinkButton/SiteLinkButton.jsx` 
   ,  **https://boykovgroup.ru**  
.       `VITE_SITE_URL`
(`client/.env`),        .

## 

 `server/src/data/instructions/`  7 -:
6    ( ,    ,
 ,  ,  , 
 )       
       JSON    .
        ,  
     (. 
   )    ,   .
     `server/src/data/professionQueue.json`.

     (`instructionsRepository.js`)
            
`getAll / getById / save`,     .
