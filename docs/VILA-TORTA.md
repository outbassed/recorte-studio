# Vila Torta na Biblioteca

Os pacotes de Vila Torta usam **apenas o que existe nos dois episódios** (`T1E1` e `T1E2`, branch `claude/vila-torta-t1e1-producao-a3k6yr`). Os episódios **não foram alterados**.

## O que entrou (95 itens, extraídos sem alteração)

Extração reprodutível: `tools/packs/vila-torta/extract.run.ts` (dados em `tools/packs/sources/vila-torta/data/`, procedência com sha256 de cada `.jrec` em `provenance.json`). IDs, desenhos e notas canônicas são **exatamente** os dos episódios (um teste confere item a item).

| Pacote | Itens | Conteúdo |
| --- | ---: | --- |
| `vila-torta-personagens-1` | 7 | Rafael, Beatriz, Caíque, Samuca, Larissa, Senhor Gaivota, Doutor Pinote |
| `vila-torta-personagens-2` | 17 | Dona Marta, Seu Agenor, Motorista, Assessor do Gaivota, Assessora do Pinote, Apresentador, Dono da gráfica, Funcionários da prefeitura A e B, Vendedor ambulante, **Lon Ruan** (cantor), Seu Norberto (Fiscal da Rua), Dona Zefa, Rapaz da bicicleta, Dono do cachorro, Produtor do show, Repórter local |
| `vila-torta-personagens-3` | 12 | Eleitora 1, Eleitor 2, Eleitora 3, Eleitor 4, Eleitora 5, Eleitor 6, Segurança A e B, Policial A e B, Integrantes dos grupos vermelho e cinza |
| `vila-torta-assets-1` | 26 | campanha, debate, gráfica e sinalização (T1E1) |
| `vila-torta-assets-2` | 21 | o show e o fiscal (T1E2) e itens pessoais |
| `vila-torta-veiculos-1` | 6 | carro, carro preto, viatura, caminhão da prefeitura, roda, mola |
| `vila-torta-cenarios-1` | 6 | pátio escolar, camarins, gráfica, comitê do Pinote, bastidores do palco |

Total real nos episódios: **36 personagens distintos, 53 objetos, 6 cenários**. 8 personagens e 5 cenários eram o **mesmo desenho com IDs diferentes** entre os episódios (ex.: "Eleitora 1" é `char_m0masz773y` no T1E1 e `char_tioydvr4vi` no T1E2); entram uma vez só, com o ID do T1E1 (os 13 aliases ficam registrados em `provenance.json`).

## O que NÃO entrou, e por quê

- **Ramires Narigatti, Valentina Fernández, Rodrigues Narigatti e "Narigaço":** não aparecem em nenhum dos dois episódios (0 ocorrências nos arquivos). Têm descrição conceitual, **não desenho aprovado**. Um teste garante que esses nomes não estão em nenhum pacote.
- **Pais dos protagonistas** (Nogueira, Barbosa, Oliveira, Almeida): nomes, profissões e visuais ainda indefinidos. Nada foi inventado.
- **`vila-torta-roupas-cabelos-1`:** roupas e cabelos ainda não são itens independentes na `main` (ver `PACOTES-OFICIAIS.md`).
- **Áudio dos episódios** (base de trap, ambientes, efeitos): pacotes ainda não carregam sons.

## Dependem de sua aprovação

1. Aparência de **Ramires** e **Valentina** (as descrições estão registradas acima e no prompt; qualquer desenho só será declarado oficial com a sua aprovação visual).
2. Tudo sobre **Rodrigues** e os **pais dos protagonistas**.
3. **Licença de redistribuição** dos pacotes de Vila Torta: os manifestos dizem "obra original do autor do Recorte Studio; uso nos seus projetos; licença de redistribuição pendente de definição do autor".

## Observação sobre as notas dos personagens

As notas canônicas (`notes`) vêm dos episódios e foram preservadas. Há pontos em que elas e a sua descrição desta conversa **não coincidem exatamente** (por exemplo, a nota da Larissa diz que ela tem interesse por outro garoto, e a do Samuca fala de timidez com "desconhecidos e garotas"). Não alterei nada; fica registrado caso queira reconciliar.
