#!/usr/bin/env python3
"""Fetch completed English league matches from football-data.co.uk; no odds are fabricated."""
import csv, io, json, pathlib, urllib.request, datetime
BASE='https://www.football-data.co.uk/mmz4281/{season}/{league}.csv'
LEAGUES=('E0','E1','E2','E3')
OUT=pathlib.Path(__file__).resolve().parents[1]/'data'/'all_matches.json'
records={}; errors=[]
for year in range(2021,2027):
    season=f'{year%100:02d}{(year+1)%100:02d}'
    for league in LEAGUES:
        url=BASE.format(season=season,league=league)
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'EnglandOverLab/1.8 (historical research)'})
            with urllib.request.urlopen(req,timeout=25) as response:
                content=response.read().decode('cp1252-sig',errors='replace')
            count=0
            for row in csv.DictReader(io.StringIO(content)):
                if not row or row.get('FTR') not in ('H','D','A'): continue
                home=(row.get('HomeTeam') or '').strip();away=(row.get('AwayTeam') or '').strip()
                try:
                    hg=int(row.get('FTHG',''));ag=int(row.get('FTAG',''))
                    raw=(row.get('Date') or '').strip()
                    parts=raw.split('/')
                    if len(parts)!=3:continue
                    day,month,yr=map(int,parts)
                    if yr<100:yr+=2000 if yr<80 else 1900
                    date=datetime.date(yr,month,day).isoformat()
                except (ValueError,TypeError):continue
                if not home or not away or hg<0 or ag<0 or date>datetime.date.today().isoformat():continue
                key=(league,date,home,away)
                records[key]={'league':league,'date':date,'home':home,'away':away,'hg':hg,'ag':ag}
                count+=1
            print(f'{season} {league}: {count} valid')
        except Exception as exc:
            errors.append(f'{season} {league}: {exc}')
if errors: print('Errors:',*errors,sep='\n')
# Refuse incomplete updates; keep existing dataset intact.
counts={league:sum(r['league']==league for r in records.values()) for league in LEAGUES}
if min(counts.values())<1000:
    raise SystemExit(f'Incomplete download; refusing to overwrite dataset: {counts}')
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(sorted(records.values(),key=lambda x:(x['date'],x['league'],x['home'])),ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
print(f'Saved {len(records)} records: {counts}')
