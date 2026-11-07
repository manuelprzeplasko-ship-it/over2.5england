"""Pobierz historyczne wyniki Premier League z dozwolonego źródła CSV.
Uruchamiaj nie częściej niż 2 razy w tygodniu, zgodnie z warunkami dostawcy.
"""
import csv, io, json, pathlib, urllib.request, datetime
ROOT=pathlib.Path(__file__).resolve().parents[1]
NOW=datetime.date.today()
seasons=[f'{str(y)[-2:]}{str(y+1)[-2:]}' for y in range(NOW.year-5,NOW.year+1)]
rows={}
for season in seasons:
    url=f'https://www.football-data.co.uk/mmz4281/{season}/E0.csv'
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'PremierOverLab/1.0 (personal research)'})
        with urllib.request.urlopen(req,timeout=25) as r: raw=r.read().decode('utf-8-sig',errors='replace')
        for x in csv.DictReader(io.StringIO(raw)):
            if x.get('FTR') not in ('H','D','A') or not x.get('HomeTeam') or not x.get('AwayTeam'):continue
            try:
                day=datetime.datetime.strptime(x['Date'], '%d/%m/%Y').date()
            except ValueError:
                try:day=datetime.datetime.strptime(x['Date'], '%d/%m/%y').date()
                except ValueError:continue
            try:hg=int(x['FTHG']);ag=int(x['FTAG'])
            except (TypeError,ValueError):continue
            if not(0<=hg<=30 and 0<=ag<=30):continue
            item={'date':day.isoformat(),'home':x['HomeTeam'].strip(),'away':x['AwayTeam'].strip(),'hg':hg,'ag':ag}
            rows[(item['date'],item['home'],item['away'])]=item
        print('OK',season)
    except Exception as e:print('WARN',season,str(e))
if not rows:raise SystemExit('Nie udało się pobrać danych. Zachowano poprzedni plik.')
output=sorted(rows.values(),key=lambda x:(x['date'],x['home'],x['away']))
(ROOT/'data'/'matches.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Zapisano',len(output),'meczów')
