Atentie arhiva contine si node_modules insa e posibil sa aveti nevoie sa reinstalati vreun pachet.

Creati o bază de date 
- fie din pgadmin (interfata grafica) 
- fie din consola psql cu comanda:
CREATE DATABASE nume_baza_date ENCODING 'UTF-8' LC_COLLATE 'ro-RO-x-icu' LC_CTYPE 'ro_RO' TEMPLATE template0;


In pgadmin selectati baza voastra de date, deschideti o fereastra noua de query (Alt+Shift+Q) 
si copiati continutul fisierului sql. Apoi rulati (F5 sau butonul cu triunghiuletul).

Nu rulati fisierul sql cu psql deoarece veti avea probleme la diacritice. Motivul vine din faptul
 ca atat cmd cat si powershell au default encodingul UTF-16, dar fisierul e salvat UTF-8. 
 Daca il salvati ca utf-16 nu se va mai potrivi cu encodingul bazei de date. Solutia ar fi sa schimbati 
 encondingul default al consolei dar e prferabil sa evitam asta, ca sa nu faceti vreo setare care sa va strice eventual alte lucruri.

 
După ce ați creat tabelul, creati un utilizator nou cu comanda:
CREATE USER nume_utilizator WITH ENCRYPTED PASSWORD 'parola';
GRANT ALL PRIVILEGES ON DATABASE nume_baza_date TO nume_utilizator ;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO nume_utilizator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO nume_utilizator;