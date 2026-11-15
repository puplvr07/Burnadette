import type { GapPeriod, WeekRow } from './types';
export type CompleteYear = {year:number;mean:number;count:number};
export function completeYears(weeks:WeekRow[],start:string,end:string,gaps:GapPeriod[]):CompleteYear[] {
 const byDate=new Map<string,WeekRow[]>();
 for(const row of weeks) byDate.set(row.week_start,[...(byDate.get(row.week_start)??[]),row]);
 const years:CompleteYear[]=[];
 for(let year=Number(start.slice(0,4));year<=Number(end.slice(0,4));year++){
  const first=new Date(Date.UTC(year,0,1));first.setUTCDate(first.getUTCDate()+(8-first.getUTCDay())%7);
  const dates:string[]=[];
  for(let date=first;date.getUTCFullYear()===year;date=new Date(date.getTime()+7*86400000)) dates.push(date.toISOString().slice(0,10));
  if(!dates.length||dates[0]<start||dates[dates.length-1]>end)continue;
  if(gaps.some(g=>g.start<=`${year}-12-31`&&g.end>=`${year}-01-01`))continue;
  const rows=dates.map(date=>byDate.get(date));
  if(rows.some(group=>group?.length!==1||group[0].value==null||!Number.isFinite(group[0].value)))continue;
  const values=rows.map(group=>group![0].value!);
  years.push({year,mean:values.reduce((a,b)=>a+b,0)/values.length,count:values.length});
 }
 return years;
}
